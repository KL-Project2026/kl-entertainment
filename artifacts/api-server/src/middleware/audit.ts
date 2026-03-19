import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { auditLog } from "@workspace/db/schema";

export function auditWrite(entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const result = originalJson(body);

      if (res.statusCode < 400 && req.user && body && typeof body === "object") {
        const data = (body as Record<string, unknown>).data as Record<string, unknown> | undefined;
        const entityId = data?.id as string | undefined;
        if (entityId) {
          db.insert(auditLog).values({
            entity_type: entityType,
            entity_id: entityId,
            action: req.method === "POST" ? "create" : req.method === "PUT" ? "update" : "delete",
            changed_by: req.user.id,
            new_values: body as Record<string, unknown>,
            ip_address: req.ip,
            user_agent: req.get("user-agent"),
          }).catch(() => {});
        }
      }

      return result;
    };

    next();
  };
}
