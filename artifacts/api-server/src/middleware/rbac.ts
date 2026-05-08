import { Request, Response, NextFunction } from "express";
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
 * SUPER_ADMIN auto-passes via requireRole internal check.
 * Usage: router.use(authenticate, blockInvestor)
 */
export const blockInvestor = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
  ROLES.HOSTESS,
  ROLES.DRIVER,
  ROLES.KITCHEN,
  ROLES.HALL,
  ROLES.GENERAL,
);
