import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { customerAuditLog } from "@workspace/db/schema";

// Customer-portal audit writer. Mirrors auditWrite() but targets the
// isolated customer_audit_log table (OPERATIONS_WORKFLOW.md §13).
// Use auditCustomerWrite as middleware for routes that mutate customer-owned
// entities, or call writeCustomerAudit() directly from auth/login flows.

export function auditCustomerWrite(entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const result = originalJson(body);

      const customerId = (req as Request & { customerId?: string }).customerId;
      if (res.statusCode < 400 && customerId && body && typeof body === "object") {
        const data = (body as Record<string, unknown>).data as Record<string, unknown> | undefined;
        const entityId = (data?.id as string | undefined) ?? customerId;
        db.insert(customerAuditLog).values({
          entity_type: entityType,
          entity_id: entityId,
          action: req.method === "POST" ? "create" : req.method === "PUT" ? "update" : "delete",
          customer_id: customerId,
          new_values: body as Record<string, unknown>,
          ip_address: req.ip,
          user_agent: req.get("user-agent"),
        }).catch(() => {});
      }

      return result;
    };

    next();
  };
}

export interface CustomerAuditEvent {
  entityType: string;
  entityId: string;
  action: string;
  customerId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function writeCustomerAudit(event: CustomerAuditEvent): void {
  db.insert(customerAuditLog).values({
    entity_type: event.entityType,
    entity_id: event.entityId,
    action: event.action,
    customer_id: event.customerId ?? null,
    old_values: event.oldValues ?? null,
    new_values: event.newValues ?? null,
    ip_address: event.ipAddress ?? null,
    user_agent: event.userAgent ?? null,
  }).catch(() => {});
}
