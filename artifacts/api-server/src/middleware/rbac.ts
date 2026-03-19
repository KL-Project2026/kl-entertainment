import { Request, Response, NextFunction } from "express";
import { ROLES } from "../config/constants";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    if (allowedRoles.includes("*") || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "FORBIDDEN" });
  };
}

export function requireBranchAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const superRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
  if (superRoles.includes(req.user.role as typeof ROLES[keyof typeof ROLES])) {
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
