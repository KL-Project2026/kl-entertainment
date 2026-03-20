import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { enforceBranchScope } from "../middleware/scopeGuards";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// branch_manager AND manager both count as "store manager" equivalent
const managerAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
);

// ── GET /manager/dashboard ──────────────────────────────────────────────────
// Today's branch operations summary (read-only)
router.get(
  "/manager/dashboard",
  authenticate,
  managerAccess,
  enforceBranchScope,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.scopedBranchId ?? (req.query["branch_id"] as string | undefined);
      const today    = new Date().toISOString().split("T")[0];

      if (!branchId) {
        // super_admin/admin with no branch_id: return multi-branch summary
        const { rows: roomSummary } = await pool.query(
          `SELECT b.name AS branch_name, r.status, COUNT(*) AS count
           FROM rooms r JOIN branches b ON b.id = r.branch_id
           WHERE r.is_active = true AND r.deleted_at IS NULL
           GROUP BY b.name, r.status ORDER BY b.name, r.status`
        );
        res.json({
          arrivals_today:   0,
          departures_today: 0,
          room_status_summary: roomSummary,
          multi_branch: true,
        });
        return;
      }

      const [arrivalsRes, departuresRes, roomsRes, hostessRes, sessionsRes] =
        await Promise.all([
          pool.query(
            `SELECT COUNT(*) AS count FROM reservations
             WHERE branch_id = $1 AND DATE(start_time) = $2 AND status = 'confirmed'`,
            [branchId, today]
          ),
          pool.query(
            `SELECT COUNT(*) AS count FROM reservations
             WHERE branch_id = $1 AND DATE(end_time) = $2 AND status = 'checked_in'`,
            [branchId, today]
          ),
          pool.query(
            `SELECT status, COUNT(*) AS count FROM rooms
             WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL
             GROUP BY status ORDER BY status`,
            [branchId]
          ),
          pool.query(
            `SELECT COUNT(*) AS count FROM staff
             WHERE branch_id = $1 AND role = 'hostess' AND is_active = true AND deleted_at IS NULL`,
            [branchId]
          ),
          pool.query(
            `SELECT COUNT(*) AS count, COALESCE(SUM(hs.net_payout), 0) AS today_commission
             FROM hostess_sessions hs
             JOIN reservations r ON r.id = hs.reservation_id
             WHERE r.branch_id = $1 AND DATE(hs.start_at) = $2`,
            [branchId, today]
          ),
        ]);

      res.json({
        arrivals_today:      parseInt(String(arrivalsRes.rows[0]?.count ?? 0)),
        departures_today:    parseInt(String(departuresRes.rows[0]?.count ?? 0)),
        room_status_summary: roomsRes.rows,
        active_hostesses:    parseInt(String(hostessRes.rows[0]?.count ?? 0)),
        today_sessions:      parseInt(String(sessionsRes.rows[0]?.count ?? 0)),
        today_commission:    parseFloat(String(sessionsRes.rows[0]?.today_commission ?? 0)),
        currency:            "MYR",
        branch_id:           branchId,
        date:                today,
      });
    } catch (err) {
      console.error("[Manager] dashboard error:", err);
      res.status(500).json({ error: "Dashboard load failed" });
    }
  }
);

// ── GET /manager/hostesses/active ──────────────────────────────────────────
// Active hostess list for current branch (staff with role='hostess')
// agent_fee_rate hidden for branch_manager role
router.get(
  "/manager/hostesses/active",
  authenticate,
  managerAccess,
  enforceBranchScope,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.scopedBranchId ?? (req.query["branch_id"] as string | undefined);
      const role     = req.user!.role;
      const isAdmin  = ([ROLES.SUPER_ADMIN, ROLES.ADMIN] as string[]).includes(role);

      const { rows } = await pool.query(
        `SELECT
           s.id,
           s.full_name AS name,
           s.role,
           s.is_active,
           s.phone,
           ${isAdmin ? "s.commission_config," : "NULL AS commission_config,"}
           rh.reservation_id AS current_reservation_id,
           r.room_id        AS current_room_id,
           rm.name          AS current_room_name,
           r.status         AS reservation_status
         FROM staff s
         LEFT JOIN reservation_hostesses rh
           ON rh.hostess_id = s.id AND rh.status = 'active'
         LEFT JOIN reservations r
           ON r.id = rh.reservation_id AND r.status IN ('confirmed','checked_in')
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE s.role = 'hostess'
           AND s.is_active = true
           AND s.deleted_at IS NULL
           ${branchId ? "AND s.branch_id = $1" : ""}
         ORDER BY s.full_name`,
        branchId ? [branchId] : []
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[Manager] hostesses/active error:", err);
      res.status(500).json({ error: "Failed to fetch active hostesses" });
    }
  }
);

// ── GET /manager/commissions ────────────────────────────────────────────────
// Branch commission overview (read-only) — from hostess_sessions
// customer_name never returned; agent_commission hidden for branch_manager
router.get(
  "/manager/commissions",
  authenticate,
  managerAccess,
  enforceBranchScope,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.scopedBranchId ?? (req.query["branch_id"] as string | undefined);
      const period   = req.query["period"] as string | undefined;
      const role     = req.user!.role;
      const isAdmin  = ([ROLES.SUPER_ADMIN, ROLES.ADMIN] as string[]).includes(role);

      const whereParts: string[] = ["r.deleted_at IS NULL"];
      const params: unknown[]    = [];
      let pIdx = 1;

      if (branchId) {
        whereParts.push(`r.branch_id = $${pIdx++}`);
        params.push(branchId);
      }
      if (period) {
        whereParts.push(`TO_CHAR(hs.start_at, 'YYYY-MM') = $${pIdx++}`);
        params.push(period);
      } else {
        whereParts.push("hs.start_at >= NOW() - INTERVAL '30 days'");
      }

      const where = whereParts.join(" AND ");
      const { rows } = await pool.query(
        `SELECT
           hs.id,
           hs.start_at,
           hs.end_at,
           hs.hours_worked,
           hs.gross_amount,
           hs.payout_rate,
           hs.net_payout,
           ${isAdmin ? "hs.agent_commission," : "NULL AS agent_commission,"}
           hs.status,
           s.full_name    AS hostess_name,
           rm.name        AS room_name,
           NULL           AS customer_name
         FROM hostess_sessions hs
         JOIN reservations r  ON r.id  = hs.reservation_id
         JOIN staff        s  ON s.id  = hs.hostess_id
         LEFT JOIN rooms   rm ON rm.id = r.room_id
         WHERE ${where}
         ORDER BY hs.start_at DESC
         LIMIT 100`,
        params
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[Manager] commissions error:", err);
      res.status(500).json({ error: "Failed to fetch commissions" });
    }
  }
);

// ── GET /manager/attendance ─────────────────────────────────────────────────
// Today's attendance for the branch — read-only
router.get(
  "/manager/attendance",
  authenticate,
  managerAccess,
  enforceBranchScope,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.scopedBranchId ?? (req.query["branch_id"] as string | undefined);
      const date     = (req.query["date"] as string | undefined) ?? new Date().toISOString().split("T")[0];

      const { rows } = await pool.query(
        `SELECT
           a.id, a.work_date, a.clock_in, a.clock_out,
           a.status, a.hours_worked, a.late_minutes,
           a.notes,
           s.full_name AS staff_name,
           s.role      AS staff_role
         FROM attendance a
         JOIN staff s ON s.id = a.staff_id
         WHERE a.work_date = $1
           ${branchId ? "AND a.branch_id = $2" : ""}
         ORDER BY a.clock_in ASC NULLS LAST`,
        branchId ? [date, branchId] : [date]
      );

      res.json({ data: rows, date });
    } catch (err) {
      console.error("[Manager] attendance error:", err);
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  }
);

export default router;
