import { pool } from "@workspace/db";
import { formatMYR } from "./order-service";
import { getMaskedDisplayName } from "../utils/invoiceFormatter";

interface BranchInfo {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  tax_config: Record<string, unknown> | null;
}

interface ReservationInfo {
  reservation_no: string;
  room_name: string;
  room_type: string;
  duration_hours: number | null;
  guest_count: number;
  checked_in_at: Date | null;
  end_time: Date | null;
}

interface OrderItemRow {
  id:                   string;
  description:          string;
  quantity:             number;
  unit_price:           number;
  discount_pct:         number;
  line_total:           number;
  tax_applicable:       boolean;
  // Category masking fields (nullable — item may not be in a menu_items entry)
  visibility_level:     string | null;
  invoice_display_mode: string | null;
  invoice_alias:        string | null;
}

interface OrderInfo {
  order_no: string;
  subtotal: number;
  sst_amount: number;
  service_charge: number;
  total_amount: number;
  payment_method: string | null;
  payment_ref: string | null;
  finalized_at: Date | null;
}

interface ReceiptInfo {
  receipt_no: string;
  amount_paid: number;
  payment_method: string;
  payment_ref: string | null;
  payment_at: Date;
  receipt_mode: string;
}

async function fetchOrderData(orderId: string) {
  const { rows: orderRows } = await pool.query(
    `SELECT o.*, b.name AS branch_name, b.address, b.city, b.phone, b.email, b.currency, b.tax_config
     FROM orders o
     JOIN branches b ON b.id = o.branch_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!orderRows.length) throw new Error("ORDER_NOT_FOUND");
  const order = orderRows[0] as OrderInfo & BranchInfo & { branch_name: string; reservation_id: string };

  const { rows: itemRows } = await pool.query(
    `SELECT oi.*, p.tax_applicable,
            mc.visibility_level, mc.invoice_display_mode, mc.invoice_alias
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN menu_items mi ON mi.product_id = oi.product_id AND mi.is_deleted = false
     LEFT JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE oi.order_id = $1 ORDER BY oi.created_at`,
    [orderId]
  );

  let reservation: ReservationInfo | null = null;
  if (order.reservation_id) {
    const { rows: resRows } = await pool.query(
      `SELECT r.reservation_no, rm.name AS room_name, rm.room_type,
              r.duration_hours, r.guest_count, r.checked_in_at, r.end_time
       FROM reservations r
       LEFT JOIN rooms rm ON rm.id = r.room_id
       WHERE r.id = $1`,
      [order.reservation_id]
    );
    if (resRows.length) reservation = resRows[0] as ReservationInfo;
  }

  return { order, items: itemRows as OrderItemRow[], reservation };
}

function formatDateTime(dt: Date | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(dt: Date | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-MY", { dateStyle: "medium" });
}

function roomTypeLabel(type: string): string {
  const map: Record<string, string> = {
    private_room: "Private Room",
    vip_room: "VIP Room",
    vvip_room: "VVIP Suite",
    table: "Table",
    open_area: "Open Area",
  };
  return map[type] ?? type;
}

function paymentMethodLabel(method: string | null): string {
  const map: Record<string, string> = {
    cash: "Cash",
    qr_touchngo: "QR — Touch'n Go",
    qr_grabpay: "QR — GrabPay",
    fpx: "FPX Online Banking",
    card: "Credit/Debit Card",
    credit_account: "House Credit",
    bank_transfer: "Bank Transfer",
  };
  return map[method ?? ""] ?? (method ?? "—");
}

export async function generateInvoiceHtml(orderId: string, mode: "detailed" | "basic" = "detailed"): Promise<string> {
  const { order, items, reservation } = await fetchOrderData(orderId);

  if (mode === "basic") {
    return generateThermalHtml({
      title: "INVOICE",
      docNo: order.order_no,
      branchName: order.branch_name,
      roomName: reservation?.room_name ?? null,
      durationHours: reservation?.duration_hours ?? null,
      dateTime: formatDateTime(order.finalized_at),
      total: order.total_amount,
      paymentMethod: paymentMethodLabel(order.payment_method),
    });
  }

  return generateDetailedHtml({
    title: "INVOICE",
    docNo: order.order_no,
    branchName: order.branch_name,
    branchAddress: [order.address, order.city].filter(Boolean).join(", "),
    branchPhone: order.phone ?? "",
    reservation,
    items,
    subtotal: order.subtotal,
    sstAmount: order.sst_amount,
    serviceCharge: order.service_charge,
    totalAmount: order.total_amount,
    paymentMethod: paymentMethodLabel(order.payment_method),
    issuedAt: formatDateTime(order.finalized_at),
  });
}

export async function generateReceiptHtml(receiptId: string, mode: "detailed" | "basic" = "detailed"): Promise<string> {
  const { rows: rcptRows } = await pool.query(
    `SELECT rc.*, b.name AS branch_name, b.address, b.city, b.phone, b.currency,
            o.subtotal, o.sst_amount, o.service_charge, o.total_amount,
            o.reservation_id, o.order_no, o.payment_method AS order_payment_method
     FROM receipts rc
     JOIN orders o ON o.id = rc.order_id
     JOIN branches b ON b.id = rc.branch_id
     WHERE rc.id = $1`,
    [receiptId]
  );
  if (!rcptRows.length) throw new Error("RECEIPT_NOT_FOUND");

  const rcpt = rcptRows[0] as ReceiptInfo & BranchInfo & {
    branch_name: string;
    order_no: string;
    reservation_id: string | null;
    subtotal: number;
    sst_amount: number;
    service_charge: number;
    total_amount: number;
    order_payment_method: string | null;
  };

  const { rows: itemRows } = await pool.query(
    `SELECT oi.*, p.tax_applicable FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     JOIN receipts rc ON rc.order_id = o.id
     WHERE rc.id = $1 ORDER BY oi.created_at`,
    [receiptId]
  );

  let reservation: ReservationInfo | null = null;
  if (rcpt.reservation_id) {
    const { rows: resRows } = await pool.query(
      `SELECT r.reservation_no, rm.name AS room_name, rm.room_type,
              r.duration_hours, r.guest_count, r.checked_in_at, r.end_time
       FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id WHERE r.id = $1`,
      [rcpt.reservation_id]
    );
    if (resRows.length) reservation = resRows[0] as ReservationInfo;
  }

  if (mode === "basic") {
    return generateThermalHtml({
      title: "RECEIPT",
      docNo: rcpt.receipt_no,
      branchName: rcpt.branch_name,
      roomName: reservation?.room_name ?? null,
      durationHours: reservation?.duration_hours ?? null,
      dateTime: formatDateTime(rcpt.payment_at),
      total: rcpt.amount_paid,
      paymentMethod: paymentMethodLabel(rcpt.payment_method),
    });
  }

  return generateDetailedHtml({
    title: "RECEIPT",
    docNo: rcpt.receipt_no,
    branchName: rcpt.branch_name,
    branchAddress: [rcpt.address, rcpt.city].filter(Boolean).join(", "),
    branchPhone: rcpt.phone ?? "",
    reservation,
    items: itemRows as OrderItemRow[],
    subtotal: rcpt.subtotal,
    sstAmount: rcpt.sst_amount,
    serviceCharge: rcpt.service_charge,
    totalAmount: rcpt.total_amount,
    paymentMethod: paymentMethodLabel(rcpt.payment_method),
    issuedAt: formatDateTime(rcpt.payment_at),
  });
}

interface DetailedHtmlParams {
  title: string;
  docNo: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  reservation: ReservationInfo | null;
  items: OrderItemRow[];
  subtotal: number;
  sstAmount: number;
  serviceCharge: number;
  totalAmount: number;
  paymentMethod: string;
  issuedAt: string;
}

function generateDetailedHtml(p: DetailedHtmlParams): string {
  const itemRows = p.items
    .map(
      (i) => {
        // Apply special category masking — real names must never appear in PDF output
        const displayName = getMaskedDisplayName(
          i.visibility_level
            ? { visibility_level: i.visibility_level,
                invoice_display_mode: i.invoice_display_mode ?? "REAL_NAME",
                invoice_alias: i.invoice_alias ?? null }
            : null,
          { id: i.id, description: i.description }
        );
        return `
    <tr>
      <td>${displayName}</td>
      <td class="center">${i.quantity}</td>
      <td class="right">${formatMYR(Number(i.unit_price))}</td>
      <td class="right">${Number(i.discount_pct) > 0 ? Math.round(Number(i.discount_pct) * 100) + "%" : "—"}</td>
      <td class="right">${formatMYR(Number(i.line_total))}</td>
    </tr>`;
      }
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p.title} — ${p.docNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 18pt; font-weight: bold; }
    .brand-sub { font-size: 9pt; color: #555; margin-top: 4px; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 20pt; font-weight: bold; letter-spacing: 2px; }
    .doc-title p { font-size: 9pt; color: #555; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 16px; font-size: 9pt; }
    .meta-label { color: #666; }
    .items-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
    .items-table th { background: #f0f0f0; padding: 6px 8px; border: 0.5pt solid #ccc; text-align: left; font-size: 9pt; }
    .items-table td { padding: 5px 8px; border: 0.5pt solid #ddd; }
    .items-table .center { text-align: center; }
    .items-table .right { text-align: right; }
    .totals { margin-left: auto; margin-top: 8px; min-width: 240px; font-size: 10pt; }
    .totals tr td { padding: 3px 6px; }
    .totals tr td:first-child { color: #555; }
    .totals tr td:last-child { text-align: right; font-weight: 500; }
    .total-final td { font-size: 12pt; font-weight: bold; border-top: 2px solid #000; padding-top: 6px !important; }
    .payment-line { margin-top: 12px; font-size: 10pt; }
    .footer { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 8.5pt; color: #888; text-align: center; }
    @media print {
      @page { size: A4 portrait; margin: 18mm 14mm; }
      body { padding: 0; font-size: 10pt; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${p.branchName}</div>
      <div class="brand-sub">${p.branchAddress}</div>
      ${p.branchPhone ? `<div class="brand-sub">Tel: ${p.branchPhone}</div>` : ""}
    </div>
    <div class="doc-title">
      <h1>${p.title}</h1>
      <p>${p.docNo}</p>
      <p>${p.issuedAt}</p>
    </div>
  </div>

  ${p.reservation ? `
  <div class="meta">
    <div><span class="meta-label">Reservation:</span> ${p.reservation.reservation_no}</div>
    <div><span class="meta-label">Room:</span> ${p.reservation.room_name} (${roomTypeLabel(p.reservation.room_type)})</div>
    <div><span class="meta-label">Check-in:</span> ${formatDateTime(p.reservation.checked_in_at)}</div>
    <div><span class="meta-label">Duration:</span> ${p.reservation.duration_hours ?? "—"}h</div>
    <div><span class="meta-label">Guests:</span> ${p.reservation.guest_count}</div>
  </div>` : ""}

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Discount</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>${formatMYR(p.subtotal)}</td></tr>
    <tr><td>SST (6%)</td><td>${formatMYR(p.sstAmount)}</td></tr>
    <tr><td>Service Charge (10%)</td><td>${formatMYR(p.serviceCharge)}</td></tr>
    <tr class="total-final"><td>TOTAL</td><td>${formatMYR(p.totalAmount)}</td></tr>
  </table>

  <div class="payment-line">Payment: <strong>${p.paymentMethod}</strong></div>

  <div class="footer">Thank you for choosing ${p.branchName}. We look forward to serving you again.</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

interface ThermalHtmlParams {
  title: string;
  docNo: string;
  branchName: string;
  roomName: string | null;
  durationHours: number | null;
  dateTime: string;
  total: number;
  paymentMethod: string;
}

function generateThermalHtml(p: ThermalHtmlParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${p.title} — ${p.docNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 9pt; width: 72mm; margin: 0 auto; background: #fff; color: #000; padding: 4mm 2mm; }
    .center { text-align: center; }
    .branch { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 3pt; }
    .doc-type { text-align: center; font-size: 10pt; letter-spacing: 2px; margin-bottom: 2pt; }
    .divider { border-top: 1pt dashed #000; margin: 4pt 0; }
    .double-line { border-top: 2pt solid #000; margin: 4pt 0; }
    .doc-no { text-align: center; font-size: 10pt; font-weight: bold; margin: 3pt 0; }
    .room-line { text-align: center; margin: 2pt 0; }
    .total-block { text-align: center; margin: 6pt 0; }
    .total-label { font-size: 9pt; }
    .total-amount { font-size: 20pt; font-weight: bold; }
    .payment { text-align: center; font-size: 10pt; font-weight: bold; margin: 3pt 0; }
    .datetime { text-align: center; font-size: 8pt; color: #333; }
    .thankyou { text-align: center; font-size: 9pt; margin-top: 6pt; }
    @media print {
      @page { size: 80mm auto; margin: 0 3mm 8mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="branch">${p.branchName.toUpperCase()}</div>
  <div class="doc-type">${p.title}</div>
  <div class="datetime">${p.dateTime}</div>
  <div class="divider"></div>
  <div class="doc-no">${p.docNo}</div>
  ${p.roomName ? `<div class="room-line">${p.roomName}${p.durationHours ? ` · ${p.durationHours}hrs` : ""}</div>` : ""}
  <div class="double-line"></div>
  <div class="total-block">
    <div class="total-label">TOTAL</div>
    <div class="total-amount">${formatMYR(p.total)}</div>
  </div>
  <div class="payment">${p.paymentMethod.toUpperCase()}</div>
  <div class="divider"></div>
  <div class="thankyou">Thank You!</div>
  <div class="thankyou">Please visit again</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}
