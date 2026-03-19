import { pgTable, uuid, char, decimal, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const fxRates = pgTable("fx_rates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  base_ccy: char("base_ccy", { length: 3 }).notNull().default("MYR"),
  quote_ccy: char("quote_ccy", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
  source: varchar("source", { length: 50 }).default("exchangerate-api"),
  fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const insertFxRateSchema = createInsertSchema(fxRates).omit({ id: true, fetched_at: true });
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;
export type FxRate = typeof fxRates.$inferSelect;
