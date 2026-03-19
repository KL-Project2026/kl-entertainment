import { pgTable, uuid, varchar, char, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  org_id: uuid("org_id").notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  internal_code: varchar("internal_code", { length: 20 }).unique().notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: char("country", { length: 2 }).default("MY"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  timezone: varchar("timezone", { length: 60 }).notNull().default("Asia/Kuala_Lumpur"),
  currency: char("currency", { length: 3 }).notNull().default("MYR"),
  operating_hours: jsonb("operating_hours"),
  tax_config: jsonb("tax_config").notNull().default(sql`'{"sst_rate":0.06,"service_charge":0.10}'::jsonb`),
  settings: jsonb("settings").notNull().default(sql`'{"default_invoice_mode":"detailed","default_receipt_mode":"detailed","show_hostess_name_on_invoice":true,"show_hostess_name_on_receipt":false,"thermal_printer_width_mm":80,"invoice_footer_text":"","sst_reg_number":""}'::jsonb`),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, created_at: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;
