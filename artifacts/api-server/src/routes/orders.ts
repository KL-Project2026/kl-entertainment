import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { calculateOrderTotals, generateOrderNo, generateReceiptNo } from "../services/order-service";
import { generateInvoiceHtml } from "../services/document-service";

const router: IRouter = Router();

function formatOrder(row: Record<string, unknown>) {
  return {
    id: row.id,
    orderNo: row.order_no,
    reservationId: row.reservation_id ?? null,
    branchId: row.branch_id,
    customerId: row.customer_id ?? null,
    orderType: row.order_type,
    subtotal: parseFloat(row.subtotal as string),
    discountAmount: parseFloat(row.discount_amount as string),
    sstAmount: parseFloat(row.sst_amount as string),
    serviceCharge: parseFloat(row.service_charge as string),
    totalAmount: parseFloat(row.total_amount as string),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? null,
    paymentRef: row.payment_ref ?? null,
    finalizedAt: row.finalized_at ?? null,
    createdAt: row.created_at,
  };
}

function formatItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    orderId: row.order_id,
    itemType: row.item_type,
    productId: row.product_id ?? null,
    description: row.description,
    quantity: parseFloat(row.quantity as string),
    unitPrice: parseFloat(row.unit_price as string),
    discountPct: parseFloat(row.discount_pct as string),
    lineTotal: parseFloat(row.line_total as string),
    staffRefId: row.staff_ref_id ?? null,
    createdAt: row.created_at,
  };
}

// Get order for reservation
router.get(
  "/orders",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reservation_id, branch_id } = req.query as Record<string, string>;

      const conditions = ["1=1"];
      const params: unknown[] = [];

      if (reservation_id) {
        params.push(reservation_id);
        conditions.push(`o.reservation_id = $${params.length}`);
      }
      if (branch_id) {
        params.push(branch_id);
        conditions.push(`o.branch_id = $${params.length}`);
      }

      const { rows } = await pool.query(
        `SELECT o.* FROM orders o WHERE ${conditions.join(" AND ")} ORDER BY o.created_at DESC LIMIT 50`,
        params
      );

      const ordersWithItems = await Promise.all(
        rows.map(async (order) => {
          const { rows: items } = await pool.query(
            "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at",
            [(order as Record<string, unknown>).id]
          );
          return { ...formatOrder(order as Record<string, unknown>), items: items.map(formatItem) };
        })
      );

      res.json({ data: ordersWithItems });
    } catch (err) {
      console.error("Get orders error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create order
router.post(
  "/orders",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      // Also accept reservationId/branchId from URL query params as fallback
      const queryReservationId = (req.query?.reservationId as string) || undefined;
      const queryBranchId = (req.query?.branchId as string) || undefined;

      const reservationId = (body.reservationId as string) || queryReservationId;

      // Resolve branchId: body → query → reservation lookup → user's JWT branch
      let branchId = ((body.branchId as string) || queryBranchId || "") as string;
      if (!branchId && reservationId) {
        const { rows: resRows } = await pool.query(
          "SELECT branch_id FROM reservations WHERE id = $1",
          [reservationId]
        );
        if (resRows.length) branchId = (resRows[0] as Record<string, string>).branch_id;
      }

      // Final fallback: use the authenticated user's assigned branch
      if (!branchId && req.user?.branchId) {
        branchId = req.user.branchId;
      }

      if (!branchId) { res.status(400).json({ error: "BRANCH_ID_REQUIRED" }); return; }

      const { rows: branchRows } = await pool.query(
        "SELECT internal_code, tax_config FROM branches WHERE id = $1",
        [branchId]
      );
      if (!branchRows.length) { res.status(404).json({ error: "BRANCH_NOT_FOUND" }); return; }
      const branch = branchRows[0] as { internal_code: string; tax_config: Record<string, unknown> | null };
      const orderNo = await generateOrderNo(branch.internal_code);

      const { rows } = await pool.query(
        `INSERT INTO orders (id, order_no, reservation_id, branch_id, customer_id, order_type,
           subtotal, discount_amount, sst_amount, service_charge, total_amount,
           payment_status, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 0, 0, 0, 0, 0, 'pending', $6)
         RETURNING *`,
        [orderNo, reservationId ?? null, branchId, body.customerId ?? null,
         body.orderType ?? "reservation", req.user!.id]
      );

      res.status(201).json({ data: { ...formatOrder(rows[0]), items: [] } });
    } catch (err) {
      console.error("Create order error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Add item to order
router.post(
  "/orders/:id/items",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (!body.description && !body.itemType) {
        res.status(400).json({ error: "ITEM_DESCRIPTION_REQUIRED" });
        return;
      }

      const qty = Number(body.quantity ?? 1) || 1;
      const unitPrice = Number(body.unitPrice ?? 0);
      // Accept discountPct as 0-100 percentage; store as 0.0-1.0 decimal for consistency
      const discountPctRaw = Number(body.discountPct ?? 0);
      const discountPct = discountPctRaw > 1
        ? Math.min(1, discountPctRaw / 100)
        : Math.min(1, Math.max(0, discountPctRaw));
      const lineTotal = Math.round(qty * unitPrice * (1 - discountPct) * 100) / 100;

      const { rows: itemRows } = await pool.query(
        `INSERT INTO order_items (id, order_id, item_type, product_id, description, quantity, unit_price, discount_pct, line_total, staff_ref_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.params.id, body.itemType ?? "product", body.productId ?? null, body.description,
         qty, unitPrice, discountPct, lineTotal, body.staffRefId ?? null]
      );

      await recalculateOrderTotals(req.params.id);

      const { rows: orderRows } = await pool.query(
        "SELECT o.*, b.tax_config FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.id = $1",
        [req.params.id]
      );
      const allItems = await getOrderItems(req.params.id);

      res.json({ data: { ...formatOrder(orderRows[0] as Record<string, unknown>), items: allItems }, newItem: formatItem(itemRows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Add item error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Remove item
router.delete(
  "/orders/:id/items/:itemId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query("DELETE FROM order_items WHERE id = $1 AND order_id = $2", [req.params.itemId, req.params.id]);
      await recalculateOrderTotals(req.params.id);

      const { rows: orderRows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const allItems = await getOrderItems(req.params.id);

      res.json({ data: { ...formatOrder(orderRows[0] as Record<string, unknown>), items: allItems } });
    } catch (err) {
      console.error("Remove item error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Apply discount
router.put(
  "/orders/:id/discount",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { discount_pct } = req.body as { discount_pct: number };
      if (discount_pct < 0 || discount_pct > 1) {
        res.status(400).json({ error: "INVALID_DISCOUNT" }); return;
      }

      const items = await getOrderItemsRaw(req.params.id);
      for (const item of items) {
        await pool.query(
          "UPDATE order_items SET discount_pct = $1, line_total = (unit_price * quantity * (1 - $1)) WHERE id = $2",
          [discount_pct, (item as Record<string, unknown>).id]
        );
      }
      await recalculateOrderTotals(req.params.id);

      const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const allItems = await getOrderItems(req.params.id);

      res.json({ data: { ...formatOrder(rows[0] as Record<string, unknown>), items: allItems } });
    } catch (err) {
      console.error("Discount error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Finalize order
router.post(
  "/orders/:id/finalize",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      const order = rows[0] as Record<string, unknown>;
      if (order.finalized_at) { res.status(422).json({ error: "ALREADY_FINALIZED" }); return; }

      await pool.query(
        "UPDATE orders SET finalized_at = now(), updated_at = now() WHERE id = $1",
        [req.params.id]
      );

      const { rows: finalRows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const allItems = await getOrderItems(req.params.id);

      res.json({ data: { ...formatOrder(finalRows[0] as Record<string, unknown>), items: allItems } });
    } catch (err) {
      console.error("Finalize error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get invoice HTML/PDF
router.get(
  "/orders/:id/invoice",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { mode = "detailed" } = req.query as Record<string, string>;
      const html = await generateInvoiceHtml(req.params.id, mode as "detailed" | "basic");
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "ORDER_NOT_FOUND") res.status(404).json({ error: "NOT_FOUND" });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Create receipt
router.post(
  "/orders/:id/receipt",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { rows: orderRows } = await pool.query(
        "SELECT o.*, b.internal_code FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.id = $1",
        [req.params.id]
      );
      if (!orderRows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      const order = orderRows[0] as Record<string, unknown> & { internal_code: string };
      const receiptNo = await generateReceiptNo(order.internal_code);

      const { rows: rcptRows } = await pool.query(
        `INSERT INTO receipts (id, receipt_no, order_id, branch_id, customer_id, customer_name,
           amount_paid, currency, payment_method, payment_ref, payment_at,
           receipt_mode, print_count, issued_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, 0, $11)
         RETURNING *`,
        [receiptNo, req.params.id, order.branch_id, order.customer_id ?? null, body.customerName ?? null,
         order.total_amount, "MYR", body.paymentMethod, body.paymentRef ?? null,
         body.receiptMode ?? "detailed", req.user!.id]
      );

      // Update order payment info
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', payment_method = $1, payment_ref = $2, updated_at = now() WHERE id = $3`,
        [body.paymentMethod, body.paymentRef ?? null, req.params.id]
      );

      res.status(201).json({ data: formatReceipt(rcptRows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Create receipt error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Latest receipt for order
router.get(
  "/orders/:id/receipt/latest",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM receipts WHERE order_id = $1 AND voided_at IS NULL ORDER BY created_at DESC LIMIT 1",
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: formatReceipt(rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Latest receipt error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

function formatReceipt(row: Record<string, unknown>) {
  return {
    id: row.id,
    receiptNo: row.receipt_no,
    orderId: row.order_id,
    branchId: row.branch_id,
    customerId: row.customer_id ?? null,
    customerName: row.customer_name ?? null,
    amountPaid: parseFloat(row.amount_paid as string),
    currency: row.currency,
    paymentMethod: row.payment_method,
    paymentRef: row.payment_ref ?? null,
    paymentAt: row.payment_at,
    receiptMode: row.receipt_mode,
    printCount: row.print_count,
    createdAt: row.created_at,
  };
}

async function recalculateOrderTotals(orderId: string): Promise<void> {
  const { rows: branchRows } = await pool.query(
    "SELECT b.tax_config FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.id = $1",
    [orderId]
  );
  const taxConfig = (branchRows[0] as { tax_config: Record<string, unknown> | null }).tax_config ?? {};

  const items = await getOrderItemsRaw(orderId);
  const totals = calculateOrderTotals(items as unknown as Parameters<typeof calculateOrderTotals>[0], taxConfig);

  await pool.query(
    `UPDATE orders SET subtotal = $1, sst_amount = $2, service_charge = $3, total_amount = $4, updated_at = now()
     WHERE id = $5`,
    [totals.subtotal, totals.sstAmount, totals.serviceCharge, totals.totalAmount, orderId]
  );
}

async function getOrderItems(orderId: string) {
  const rows = await getOrderItemsRaw(orderId);
  return rows.map(formatItem);
}

async function getOrderItemsRaw(orderId: string) {
  const { rows } = await pool.query(
    "SELECT oi.*, p.tax_applicable FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.created_at",
    [orderId]
  );
  return rows;
}

export default router;
