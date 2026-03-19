import { pgTable, uuid, varchar, jsonb, inet, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { staff } from "./staff";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entity_type: varchar("entity_type", { length: 50 }).notNull(),
  entity_id: uuid("entity_id").notNull(),
  action: varchar("action", { length: 30 }).notNull(),
  changed_by: uuid("changed_by").references(() => staff.id),
  changed_at: timestamp("changed_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  old_values: jsonb("old_values"),
  new_values: jsonb("new_values"),
  ip_address: inet("ip_address"),
  user_agent: text("user_agent"),
}, (table) => [
  index("idx_audit_entity").on(table.entity_type, table.entity_id),
  index("idx_audit_changed_at").on(table.changed_at),
]);

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, changed_at: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
