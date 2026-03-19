import { pgTable, uuid, varchar, decimal, text, boolean, smallint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { agents } from "./agents";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  org_id: uuid("org_id").notNull().references(() => organizations.id),
  customer_code: varchar("customer_code", { length: 50 }).unique(),
  full_name: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 255 }),
  password_hash: text("password_hash"),
  nationality: varchar("nationality", { length: 100 }),
  language_pref: varchar("language_pref", { length: 10 }).default("en"),
  referral_code_used: varchar("referral_code_used", { length: 50 }),
  referral_source: varchar("referral_source", { length: 30 }),
  referral_agent_id: uuid("referral_agent_id").references(() => agents.id),
  credit_balance: decimal("credit_balance", { precision: 15, scale: 4 }).notNull().default("0"),
  payment_type: varchar("payment_type", { length: 30 }).notNull().default("standard"),
  credit_limit: decimal("credit_limit", { precision: 15, scale: 4 }).notNull().default("0"),
  credit_due_day: smallint("credit_due_day"),
  vip_tier: varchar("vip_tier", { length: 20 }).default("standard"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, created_at: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
