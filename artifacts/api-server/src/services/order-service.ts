import { pool } from "@workspace/db";

export interface OrderItem {
  unit_price: number;
  quantity: number;
  discount_pct?: number;
  tax_applicable?: boolean;
}

export interface TaxConfig {
  sst_rate?: number;
  service_charge?: number;
}

export interface OrderTotals {
  subtotal: number;
  sstAmount: number;
  serviceCharge: number;
  totalAmount: number;
}

export function calculateOrderTotals(items: OrderItem[], branchTaxConfig: TaxConfig): OrderTotals {
  const { sst_rate = 0.06, service_charge = 0.10 } = branchTaxConfig;

  const subtotal = items.reduce((sum, item) => {
    const discounted = Number(item.unit_price) * Number(item.quantity) * (1 - (Number(item.discount_pct) || 0));
    return sum + discounted;
  }, 0);

  const taxableSubtotal = items
    .filter((i) => i.tax_applicable !== false)
    .reduce((sum, i) => {
      return sum + Number(i.unit_price) * Number(i.quantity) * (1 - (Number(i.discount_pct) || 0));
    }, 0);

  const sstAmount = Math.round(taxableSubtotal * sst_rate * 100) / 100;
  const serviceChargeAmt = Math.round(subtotal * service_charge * 100) / 100;
  const totalAmount = Math.round((subtotal + sstAmount + serviceChargeAmt) * 100) / 100;

  return { subtotal, sstAmount, serviceCharge: serviceChargeAmt, totalAmount };
}

export async function generateOrderNo(branchCode: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM orders WHERE order_no LIKE $1`,
    [`ORD-${branchCode}-${today}-%`]
  );
  const seq = parseInt((rows[0] as Record<string, string>).count) + 1;
  return `ORD-${branchCode}-${today}-${String(seq).padStart(3, "0")}`;
}

export async function generateReceiptNo(branchCode: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM receipts WHERE receipt_no LIKE $1`,
    [`RCP-${branchCode}-${today}-%`]
  );
  const seq = parseInt((rows[0] as Record<string, string>).count) + 1;
  return `RCP-${branchCode}-${today}-${String(seq).padStart(3, "0")}`;
}

export function formatMYR(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `RM ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
