import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { getRevenueReport, getOccupancyReport, getCommissionsReport } from "../services/reports-service";
import { calculateBranchPnL } from "../services/pnl-service";

const router: IRouter = Router();

router.get(
  "/reports/revenue",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = (req.query["branch_id"] as string) ?? req.user!.branchId;
      const today = new Date().toISOString().split("T")[0];
      const from = (req.query["from"] as string) ?? today.slice(0, 7) + "-01";
      const to = (req.query["to"] as string) ?? today;

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const data = await getRevenueReport(branchId, from, to);
      res.json({ data });
    } catch (err) {
      console.error("Revenue report error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/reports/occupancy",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = (req.query["branch_id"] as string) ?? req.user!.branchId;
      const month = (req.query["month"] as string) ?? new Date().toISOString().slice(0, 7);

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const data = await getOccupancyReport(branchId, month);
      res.json({ data });
    } catch (err) {
      console.error("Occupancy report error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/reports/commissions",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = (req.query["branch_id"] as string) ?? req.user!.branchId;
      const month = (req.query["month"] as string) ?? new Date().toISOString().slice(0, 7);

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const data = await getCommissionsReport(branchId, month);
      res.json({ data });
    } catch (err) {
      console.error("Commissions report error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/reports/profit-loss",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = (req.query["branch_id"] as string) ?? req.user!.branchId;
      const month = (req.query["month"] as string) ?? new Date().toISOString().slice(0, 7);

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const monthStart = `${month}-01`;
      const monthEnd = new Date(
        new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1, 0)
      ).toISOString().split("T")[0];

      const data = await calculateBranchPnL(branchId, monthStart, monthEnd);
      res.json({ data });
    } catch (err) {
      console.error("P&L report error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
