import { pgTable, uuid, varchar, char, decimal, text, boolean, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { organizations } from "./organizations";
import { staff } from "./staff";
import { agents } from "./agents";

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("MYR"),
  expense_date: date("expense_date").notNull(),
  period_month: char("period_month", { length: 7 }),
  reference_type: varchar("reference_type", { length: 50 }),
  reference_id: uuid("reference_id"),
  receipt_url: text("receipt_url"),
  notes: text("notes"),
  created_by: uuid("created_by").references(() => staff.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const shareholders = pgTable("shareholders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  org_id: uuid("org_id").notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  password_hash: text("password_hash"),
  nationality: varchar("nationality", { length: 100 }),
  bank_name: varchar("bank_name", { length: 100 }),
  bank_account: varchar("bank_account", { length: 100 }),
  bank_country: char("bank_country", { length: 2 }),
  swift_code: varchar("swift_code", { length: 20 }),
  preferred_currency: char("preferred_currency", { length: 3 }).default("MYR"),
  is_active: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const branchShareholders = pgTable("branch_shareholders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  shareholder_id: uuid("shareholder_id").notNull().references(() => shareholders.id),
  equity_pct: decimal("equity_pct", { precision: 6, scale: 4 }).notNull(),
  agreed_rate: decimal("agreed_rate", { precision: 6, scale: 4 }),
  effective_from: date("effective_from").notNull(),
  effective_to: date("effective_to"),
  notes: text("notes"),
});

export const profitSettlements = pgTable("profit_settlements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  branch_id: uuid("branch_id").notNull().references(() => branches.id),
  shareholder_id: uuid("shareholder_id").notNull().references(() => shareholders.id),
  period_start: date("period_start").notNull(),
  period_end: date("period_end").notNull(),
  gross_revenue: decimal("gross_revenue", { precision: 15, scale: 4 }).notNull(),
  total_expenses: decimal("total_expenses", { precision: 15, scale: 4 }).notNull(),
  net_profit: decimal("net_profit", { precision: 15, scale: 4 }).notNull(),
  equity_pct_snapshot: decimal("equity_pct_snapshot", { precision: 6, scale: 4 }).notNull(),
  settlement_amount_myr: decimal("settlement_amount_myr", { precision: 15, scale: 4 }).notNull(),
  payout_currency: char("payout_currency", { length: 3 }).notNull().default("MYR"),
  fx_rate: decimal("fx_rate", { precision: 15, scale: 6 }).notNull().default("1.0"),
  settlement_amount_fx: decimal("settlement_amount_fx", { precision: 15, scale: 4 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  pdf_url: text("pdf_url"),
  notes: text("notes"),
  approved_by: uuid("approved_by").references(() => staff.id),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  created_by: uuid("created_by").references(() => staff.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, created_at: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const insertShareholderSchema = createInsertSchema(shareholders).omit({ id: true, created_at: true });
export type InsertShareholder = z.infer<typeof insertShareholderSchema>;
export type Shareholder = typeof shareholders.$inferSelect;

export const insertBranchShareholderSchema = createInsertSchema(branchShareholders).omit({ id: true });
export type InsertBranchShareholder = z.infer<typeof insertBranchShareholderSchema>;
export type BranchShareholder = typeof branchShareholders.$inferSelect;

export const insertProfitSettlementSchema = createInsertSchema(profitSettlements).omit({ id: true, created_at: true });
export type InsertProfitSettlement = z.infer<typeof insertProfitSettlementSchema>;
export type ProfitSettlement = typeof profitSettlements.$inferSelect;

export const agentPayouts = pgTable("agent_payouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agent_id: uuid("agent_id").notNull().references(() => agents.id),
  period_from: date("period_from").notNull(),
  period_to: date("period_to").notNull(),
  amount_myr: decimal("amount_myr", { precision: 15, scale: 4 }).notNull(),
  payout_currency: char("payout_currency", { length: 3 }).notNull().default("MYR"),
  fx_rate: decimal("fx_rate", { precision: 15, scale: 6 }).notNull().default("1"),
  amount_fx: decimal("amount_fx", { precision: 15, scale: 4 }).notNull(),
  payment_method: varchar("payment_method", { length: 50 }),
  payment_ref: varchar("payment_ref", { length: 255 }),
  balance_before: decimal("balance_before", { precision: 15, scale: 4 }).notNull(),
  notes: text("notes"),
  paid_by: uuid("paid_by").references(() => staff.id),
  paid_at: timestamp("paid_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => [
  uniqueIndex("idx_agent_payouts_agent").on(table.agent_id, table.paid_at),
]);

export const insertAgentPayoutSchema = createInsertSchema(agentPayouts).omit({ id: true, created_at: true });
export type InsertAgentPayout = z.infer<typeof insertAgentPayoutSchema>;
export type AgentPayout = typeof agentPayouts.$inferSelect;
