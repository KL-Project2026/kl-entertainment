import { pgTable, uuid, varchar, jsonb, inet, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { customers } from "./customers";

// Customer-portal audit trail, kept separate from staff audit_log per
// OPERATIONS_WORKFLOW.md §13. Compliance: customer PII actions must not
// commingle with staff RBAC events.
// MIGRATION: .NET — same table, [Authorize(Policy="CustomerOnly")] writers.
export const customerAuditLog = pgTable("customer_audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entity_type: varchar("entity_type", { length: 50 }).notNull(),
  entity_id: uuid("entity_id").notNull(),
  action: varchar("action", { length: 30 }).notNull(),
  customer_id: uuid("customer_id").references(() => customers.id),
  changed_at: timestamp("changed_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  old_values: jsonb("old_values"),
  new_values: jsonb("new_values"),
  ip_address: inet("ip_address"),
  user_agent: text("user_agent"),
}, (table) => [
  index("idx_customer_audit_entity").on(table.entity_type, table.entity_id),
  index("idx_customer_audit_changed_at").on(table.changed_at),
  index("idx_customer_audit_customer").on(table.customer_id),
]);

export const insertCustomerAuditLogSchema = createInsertSchema(customerAuditLog).omit({ id: true, changed_at: true });
export type InsertCustomerAuditLog = z.infer<typeof insertCustomerAuditLogSchema>;
export type CustomerAuditLog = typeof customerAuditLog.$inferSelect;
