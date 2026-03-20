import { Request, Response, NextFunction } from "express";
import { ROLES } from "../config/constants";

// Augment Express Request with scope helpers
declare global {
  namespace Express {
    interface Request {
      scopedBranchId?: string;
      selfOnlyUserId?: string;
    }
  }
}

/**
 * enforceBranchScope
 * For branch_manager/manager and below: injects branch_id from JWT.
 * SUPER_ADMIN, ADMIN, INVESTOR bypass without restriction.
 * Fail-open: if something goes wrong existing requests are not blocked.
 */
export function enforceBranchScope(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const role     = req.user?.role;
    const branchId = req.user?.branchId;

    const bypassRoles: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVESTOR];
    if (!role || bypassRoles.includes(role)) {
      next();
      return;
    }

    if (!branchId) {
      res.status(403).json({
        error: "No branch assigned to this account. Contact your administrator.",
      });
      return;
    }

    req.scopedBranchId = branchId;

    // Inject into query for convenience — only if not already set
    const q = req.query as Record<string, string>;
    if (!q["branch_id"]) {
      q["branch_id"] = branchId;
    }

    next();
  } catch (err) {
    console.error("[ScopeGuard] enforceBranchScope error:", (err as Error).message);
    next(); // Fail open
  }
}

/**
 * selfOnlyScope
 * For HOSTESS and DRIVER: injects user_id into req.selfOnlyUserId.
 * Managers/admins pass through.
 */
export function selfOnlyScope(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const role   = req.user?.role;
    const userId = req.user?.id;

    const selfRoles: string[] = [ROLES.HOSTESS, ROLES.DRIVER];
    if (role && selfRoles.includes(role) && userId) {
      req.selfOnlyUserId = userId;
    }
    next();
  } catch (err) {
    console.error("[ScopeGuard] selfOnlyScope error:", (err as Error).message);
    next();
  }
}
