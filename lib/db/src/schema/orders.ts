import { pgTable, uuid, varchar, char, decimal, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { customers } from "./customers";
import { reservations } from "./reservations";
import { staff } from "./staff";
import { products } from "./products";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  order_no: varchar("order_no", { length: 50 }).unique().notNull(),
  reservation_id: uuid("reservation_id").references(() => reservations.id),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  customer_id: uuid("customer_id").references(() => customers.id),
  order_type: varchar("order_type", { length: 30 }).notNull().default("reservation"),
  subtotal: decimal("subtotal", { precision: 15, scale: 4 }).notNull().default("0"),
  discount_amount: decimal("discount_amount", { precision: 15, scale: 4 }).notNull().default("0"),
  sst_amount: decimal("sst_amount", { precision: 15, scale: 4 }).notNull().default("0"),
  service_charge: decimal("service_charge", { precision: 15, scale: 4 }).notNull().default("0"),
  total_amount: decimal("total_amount", { precision: 15, scale: 4 }).notNull().default("0"),
  currency: char("currency", { length: 3 }).notNull().default("MYR"),
  payment_status: varchar("payment_status", { length: 30 }).notNull().default("pending"),
  payment_method: varchar("payment_method", { length: 30 }),
  payment_ref: varchar("payment_ref", { length: 100 }),
  payment_notes: text("payment_notes"),
  invoice_pdf_url: text("invoice_pdf_url"),
  notes: text("notes"),
  created_by: uuid("created_by").references(() => staff.id),
  finalized_at: timestamp("finalized_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => [
  index("idx_orders_reservation").on(table.reservation_id),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  order_id: uuid("order_id").notNull().references(() => orders.id),
  item_type: varchar("item_type", { length: 30 }).notNull(),
  product_id: uuid("product_id").references(() => products.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
  unit_price: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  discount_pct: decimal("discount_pct", { precision: 5, scale: 4 }).notNull().default("0"),
  line_total: decimal("line_total", { precision: 15, scale: 4 }).notNull(),
  staff_ref_id: uuid("staff_ref_id").references(() => staff.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, created_at: true, updated_at: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, created_at: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
