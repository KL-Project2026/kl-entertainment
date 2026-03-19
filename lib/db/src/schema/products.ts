import { pgTable, uuid, varchar, smallint, decimal, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { branches } from "./branches";
import { organizations } from "./organizations";

export const productGroups = pgTable("product_groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  org_id: uuid("org_id").notNull().references(() => organizations.id),
  name: jsonb("name").notNull(),
  sort_order: smallint("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const productTypes = pgTable("product_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  group_id: uuid("group_id").notNull().references(() => productGroups.id),
  name: jsonb("name").notNull(),
  sort_order: smallint("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type_id: uuid("type_id").notNull().references(() => productTypes.id),
  branch_id: uuid("branch_id").references(() => branches.id),
  sku: varchar("sku", { length: 100 }),
  name: jsonb("name").notNull(),
  description: jsonb("description"),
  unit_price: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull().default("pcs"),
  tax_applicable: boolean("tax_applicable").notNull().default(true),
  images: jsonb("images"),
  sort_order: smallint("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const insertProductGroupSchema = createInsertSchema(productGroups).omit({ id: true, created_at: true });
export type InsertProductGroup = z.infer<typeof insertProductGroupSchema>;
export type ProductGroup = typeof productGroups.$inferSelect;

export const insertProductTypeSchema = createInsertSchema(productTypes).omit({ id: true, created_at: true });
export type InsertProductType = z.infer<typeof insertProductTypeSchema>;
export type ProductType = typeof productTypes.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({ id: true, created_at: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
