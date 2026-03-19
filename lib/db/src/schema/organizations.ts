import { pgTable, uuid, varchar, char, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  base_currency: char("base_currency", { length: 3 }).notNull().default("MYR"),
  default_tz: varchar("default_tz", { length: 60 }).notNull().default("Asia/Kuala_Lumpur"),
  default_lang: varchar("default_lang", { length: 10 }).notNull().default("en"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, created_at: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
