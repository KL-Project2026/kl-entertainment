import { pgTable, uuid, varchar, char, decimal, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  org_id: uuid("org_id").notNull().references(() => organizations.id),
  agent_type: varchar("agent_type", { length: 30 }).notNull().default("agency"),
  name: varchar("name", { length: 255 }).notNull(),
  contact_person: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 255 }),
  commission_type: varchar("commission_type", { length: 30 }).notNull().default("pct"),
  commission_rate: decimal("commission_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  commission_base: varchar("commission_base", { length: 30 }).notNull().default("hostess_gross"),
  payment_cycle: varchar("payment_cycle", { length: 30 }).notNull().default("monthly"),
  payment_method: varchar("payment_method", { length: 50 }),
  bank_name: varchar("bank_name", { length: 100 }),
  bank_account: varchar("bank_account", { length: 100 }),
  bank_country: char("bank_country", { length: 2 }),
  swift_code: varchar("swift_code", { length: 20 }),
  preferred_currency: char("preferred_currency", { length: 3 }).default("MYR"),
  credit_balance: decimal("credit_balance", { precision: 15, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, created_at: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
