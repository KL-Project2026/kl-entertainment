import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json({ ...data, db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() });
  }
});

// GET /api/ledger/health — Ledger system status (manager+ only)
router.get(
  "/ledger/health",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager", "manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      // Resolve org_id for this user via their branch
      const { rows: branchRows } = await pool.query<{ org_id: string }>(
        `SELECT org_id FROM branches WHERE id = (SELECT branch_id FROM staff WHERE id = $1 LIMIT 1) LIMIT 1`,
        [user.id]
      );
      const orgId = branchRows[0]?.org_id ?? null;

      const [accountsRes, entriesRes, failedRes] = await Promise.all([
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM ledger_accounts WHERE org_id = $1`,
          [orgId]
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM ledger_entries WHERE org_id = $1`,
          [orgId]
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM failed_ledger_queue WHERE org_id = $1`,
          [orgId]
        ),
      ]);

      const { rows: byType } = await pool.query<{
        account_type: string; count: string; total_balance: string;
      }>(`
        SELECT account_type,
               COUNT(*)              AS count,
               SUM(balance_cache)    AS total_balance
        FROM ledger_accounts
        WHERE org_id = $1 AND is_active = TRUE
        GROUP BY account_type
        ORDER BY account_type
      `, [orgId]);

      res.json({
        status:          "ok",
        ledger_accounts: parseInt(accountsRes.rows[0].count),
        ledger_entries:  parseInt(entriesRes.rows[0].count),
        failed_queue:    parseInt(failedRes.rows[0].count),
        by_type:         byType.map(r => ({
          account_type:  r.account_type,
          count:         parseInt(r.count),
          total_balance: parseFloat(r.total_balance ?? "0"),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        status:  "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
);

export default router;
