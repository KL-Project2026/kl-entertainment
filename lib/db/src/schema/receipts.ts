import { pgTable, uuid, varchar, char, decimal, text, smallint, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { customers } from "./customers";
import { orders } from "./orders";
import { staff } from "./staff";

export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  receipt_no: varchar("receipt_no", { length: 50 }).unique().notNull(),
  order_id: uuid("order_id").notNull().references(() => orders.id),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  customer_id: uuid("customer_id").references(() => customers.id),
  customer_name: varchar("customer_name", { length: 255 }),
  amount_paid: decimal("amount_paid", { precision: 15, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("MYR"),
  payment_method: varchar("payment_method", { length: 30 }).notNull(),
  payment_ref: varchar("payment_ref", { length: 100 }),
  payment_at: timestamp("payment_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  receipt_mode: varchar("receipt_mode", { length: 20 }).notNull().default("detailed"),
  pdf_url: text("pdf_url"),
  printed_at: timestamp("printed_at", { withTimezone: true }),
  print_count: smallint("print_count").notNull().default(0),
  voided_at: timestamp("voided_at", { withTimezone: true }),
  void_reason: text("void_reason"),
  issued_by: uuid("issued_by").references(() => staff.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => [
  index("idx_receipts_order").on(table.order_id),
  index("idx_receipts_branch").on(table.branch_id, table.payment_at),
]);

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, created_at: true });
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
