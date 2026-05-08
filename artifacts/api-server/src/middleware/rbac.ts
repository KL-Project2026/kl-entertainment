import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { ROLES, ROLE_LEVEL } from "../config/constants";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }
      if (allowedRoles.includes("*") || req.user.role === ROLES.SUPER_ADMIN || allowedRoles.includes(req.user.role)) {
        next();
        return;
      }
      res.status(403).json({
        error: "FORBIDDEN",
        required: allowedRoles,
        current: req.user.role,
      });
    } catch (err) {
      console.error("[RBAC] requireRole error:", (err as Error).message);
      res.status(403).json({ error: "Permission check failed" });
    }
  };
}

export function requireBranchAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const superRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN] as string[];
  if (superRoles.includes(req.user.role)) {
    next();
    return;
  }
  const branchId =
    (req.params as Record<string, string>).branchId ||
    (req.query as Record<string, string>).branch_id ||
    (req.body as Record<string, string>).branch_id;

  if (branchId && branchId !== req.user.branchId) {
    res.status(403).json({ error: "BRANCH_ACCESS_DENIED" });
    return;
  }
  next();
}

/**
 * requireMinLevel(level)
 * Allows any role at or above the specified hierarchy level
 */
export function requireMinLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }
      if (req.user.role === ROLES.SUPER_ADMIN) {
        next();
        return;
      }
      const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
      if (userLevel >= minLevel) {
        next();
        return;
      }
      res.status(403).json({ error: "INSUFFICIENT_PRIVILEGE" });
    } catch (err) {
      console.error("[RBAC] requireMinLevel error:", (err as Error).message);
      res.status(403).json({ error: "Permission check failed" });
    }
  };
}

/**
 * branchScope
 * Injects branch filter into req so existing list handlers can filter by branch.
 * SUPER_ADMIN and ADMIN see all. INVESTOR is filtered by investorBranchScope.
 * Others are filtered to their own branch.
 */
export function branchScope(req: Request, res: Response, next: NextFunction): void {
  try {
    const role = req.user?.role;

    if (!role || role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
      next();
      return;
    }

    if (role === ROLES.INVESTOR) {
      const scope = req.user?.investorBranchScope ?? [];
      if (scope.length > 0) {
        (req as Request & { rbac_branch_filter?: string[] }).rbac_branch_filter = scope;
      }
      next();
      return;
    }

    const branchId = req.user?.branchId;
    if (branchId) {
      (req.query as Record<string, string>).branch_id = branchId;
    }
    next();
  } catch (err) {
    console.error("[RBAC] branchScope error:", (err as Error).message);
    next();
  }
}

/**
 * investorOnly — blocks access for non-investor, non-admin roles
 */
export const investorOnly = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVESTOR,
);

/**
 * blockInvestor — Phase 9 RBAC hotfix
 * Blocks investor role from all operational routes.
 * Logs every investor denial to audit_log (non-blocking, fire-and-forget).
 * SUPER_ADMIN auto-passes; all other non-investor ops roles pass.
 * Usage: router.use(authenticate, blockInvestor)
 */
export async function blockInvestor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    const { role, id: userId } = req.user;

    // Allow every role except investor
    if (role !== ROLES.INVESTOR) {
      next();
      return;
    }

    // investor is denied — write audit trail then respond
    pool.query(
      `INSERT INTO audit_log
         (entity_type, entity_id, action, changed_by, new_values, ip_address, user_agent)
       VALUES ('rbac_access', $1, 'rbac_denied', $1, $2, $3, $4)`,
      [
        userId,
        JSON.stringify({
          role,
          path: req.originalUrl.split("?")[0],
          method: req.method,
          prefix: req.baseUrl,
          attempted: true,
        }),
        req.ip ?? null,
        (req.headers["user-agent"] ?? null) as string | null,
      ]
    ).catch((err: Error) =>
      console.error("[RBAC] audit_log write error:", err.message)
    );

    res.status(403).json({ error: "FORBIDDEN", reason: "investor_not_allowed" });
  } catch (err) {
    console.error("[RBAC] blockInvestor error:", (err as Error).message);
    res.status(403).json({ error: "Permission check failed" });
  }
}
