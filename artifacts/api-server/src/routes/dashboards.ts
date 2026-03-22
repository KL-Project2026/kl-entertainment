import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// ─── Role sets ────────────────────────────────────────────────────────────────
const investorAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVESTOR);
const branchMgrAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER);
const managerAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER);
const kitchenAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER, ROLES.KITCHEN);
const hallAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER, ROLES.HALL);

function branchOf(req: Request): string | null {
  return req.user?.branchId ?? null;
}

// ═════════════════════════════════════════════════════════════════════════════
// INVESTOR
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/dashboards/investor/summary
router.get(
  "/dashboards/investor/summary",
  authenticate, investorAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           COALESCE(SUM(total_revenue),0)     AS total_revenue_mtd,
           COALESCE(SUM(gross_profit),0)      AS gross_profit_mtd,
           COALESCE(SUM(net_profit),0)        AS net_profit_mtd,
           COALESCE(SUM(total_operating_cost),0) AS total_cost_mtd,
           COUNT(DISTINCT branch_id)          AS active_branches
         FROM investor_reports
         WHERE period = to_char(CURRENT_DATE,'YYYY-MM')`
      );
      res.json({ data: rows[0] ?? {} });
    } catch (err) {
      console.error("[dash:investor:summary]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/investor/branch-performance
router.get(
  "/dashboards/investor/branch-performance",
  authenticate, investorAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           ir.branch_name,
           ir.branch_id,
           ir.total_revenue,
           ir.gross_profit,
           ir.room_utilization_pct,
           ir.period,
           CASE WHEN ir.total_revenue > 0
                THEN ROUND((ir.gross_profit / ir.total_revenue * 100)::numeric, 1)
                ELSE 0 END AS gp_pct
         FROM investor_reports ir
         WHERE ir.period >= to_char(CURRENT_DATE - INTERVAL '7 months','YYYY-MM')
         ORDER BY ir.period DESC, ir.total_revenue DESC`
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:investor:branch-perf]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/investor/kpis
router.get(
  "/dashboards/investor/kpis",
  authenticate, investorAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           COALESCE(AVG(room_utilization_pct), 0) AS occupancy_pct,
           COUNT(DISTINCT branch_id)              AS branch_count,
           COALESCE(SUM(total_revenue), 0)        AS revenue_mtd,
           COALESCE(SUM(gross_profit), 0)         AS profit_mtd
         FROM investor_reports
         WHERE period = to_char(CURRENT_DATE,'YYYY-MM')`
      );
      const trend: Record<string, unknown>[] = (await pool.query<Record<string, unknown>>(
        `SELECT period, COALESCE(SUM(total_revenue),0) AS revenue
         FROM investor_reports
         WHERE period >= to_char(CURRENT_DATE - INTERVAL '6 months','YYYY-MM')
         GROUP BY period ORDER BY period`
      )).rows;
      res.json({ data: rows[0] ?? {}, trend });
    } catch (err) {
      console.error("[dash:investor:kpis]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// BRANCH MANAGER
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/dashboards/branch-manager/live
router.get(
  "/dashboards/branch-manager/live",
  authenticate, branchMgrAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      if (!branchId) { res.status(400).json({ error: "BRANCH_REQUIRED" }); return; }

      const today = new Date().toISOString().split("T")[0];
      const [roomsRes, resvRes, staffRes, revenueRes] = await Promise.all([
        pool.query<Record<string, unknown>>(
          `SELECT id, name, room_type, status, floor_level, capacity_min, capacity_max
           FROM rooms WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL
           ORDER BY floor_level, name`, [branchId]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT r.status, COUNT(*) AS count
           FROM reservations r
           WHERE r.branch_id = $1 AND DATE(r.start_time) = $2
           GROUP BY r.status`, [branchId, today]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT COUNT(*) AS on_duty
           FROM attendance a
           WHERE a.branch_id = $1 AND a.work_date = $2
             AND a.clock_in IS NOT NULL AND a.clock_out IS NULL`, [branchId, today]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT COALESCE(SUM(oi.line_total), 0) AS revenue_today
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE o.branch_id = $1 AND DATE(o.created_at) = $2`, [branchId, today]
        ),
      ]);

      const roomSummary = { available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
      for (const r of roomsRes.rows) {
        const s = r.status as string;
        if (s in roomSummary) (roomSummary as Record<string, number>)[s]++;
      }

      res.json({
        data: {
          rooms: roomsRes.rows,
          room_summary: roomSummary,
          reservations_today: resvRes.rows,
          staff_on_duty: parseInt(staffRes.rows[0]?.on_duty as string ?? "0", 10),
          revenue_today: parseFloat(revenueRes.rows[0]?.revenue_today as string ?? "0"),
        },
      });
    } catch (err) {
      console.error("[dash:bm:live]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/branch-manager/staff
router.get(
  "/dashboards/branch-manager/staff",
  authenticate, branchMgrAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      if (!branchId) { res.status(400).json({ error: "BRANCH_REQUIRED" }); return; }

      const today = new Date().toISOString().split("T")[0];
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           s.full_name, s.role, s.employee_code,
           a.clock_in, a.clock_out, a.status AS attendance_status,
           a.late_minutes
         FROM attendance a
         JOIN staff s ON s.id = a.staff_id
         WHERE a.branch_id = $1 AND a.work_date = $2
         ORDER BY a.clock_in NULLS LAST, s.role, s.full_name`,
        [branchId, today]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:bm:staff]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// MANAGER
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/dashboards/manager/orders
router.get(
  "/dashboards/manager/orders",
  authenticate, managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      const params: unknown[] = [];
      const clause = branchId ? `AND o.branch_id = $${(params.push(branchId), params.length)}` : "";

      const { rows: orders } = await pool.query<Record<string, unknown>>(
        `SELECT
           o.id, o.reservation_id, o.payment_status, o.created_at,
           rm.name AS room_name,
           COALESCE(SUM(oi.line_total), 0) AS order_total,
           COUNT(oi.id) AS item_count
         FROM orders o
         LEFT JOIN reservations r ON r.id = o.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.payment_status IN ('pending','partial') ${clause}
         GROUP BY o.id, rm.name
         ORDER BY o.created_at DESC
         LIMIT 50`,
        params
      );

      const openFolios: Record<string, unknown>[] = (await pool.query<Record<string, unknown>>(
        `SELECT COUNT(*) AS count FROM orders o
         WHERE o.payment_status IN ('pending','partial')
           ${branchId ? `AND o.branch_id = $1` : ""}`,
        branchId ? [branchId] : []
      )).rows;

      res.json({
        data: orders,
        summary: { open_folios: parseInt(openFolios[0]?.count as string ?? "0", 10) },
      });
    } catch (err) {
      console.error("[dash:mgr:orders]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/manager/hostesses
router.get(
  "/dashboards/manager/hostesses",
  authenticate, managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      const params: unknown[] = [];
      const clause = branchId ? `AND hp.branch_id = $${(params.push(branchId), params.length)}` : "";

      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           hp.id, s.full_name, hp.status AS profile_status,
           hs.id AS session_id,
           hs.start_at, hs.end_at, hs.rate_per_hour, hs.net_payout,
           rm.name AS room_name,
           r.reservation_no
         FROM hostess_profiles hp
         JOIN staff s ON s.id = hp.staff_id
         LEFT JOIN hostess_sessions hs ON hs.hostess_id = hp.id
           AND hs.end_at IS NULL
         LEFT JOIN reservations r ON r.id = hs.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE hp.status = 'active' ${clause}
           AND hp.deleted_at IS NULL
         ORDER BY hs.start_at NULLS LAST, s.full_name`,
        params
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:mgr:hostesses]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/dashboards/manager/comps/:id
// Approve or reject a high-discount order item (comp approval)
router.patch(
  "/dashboards/manager/comps/:id",
  authenticate, managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { action, reason } = req.body as { action: "approve" | "reject"; reason?: string };
      if (!["approve", "reject"].includes(action)) {
        res.status(400).json({ error: "INVALID_ACTION" });
        return;
      }
      // Record comp decision via order_item discount or description annotation
      const newDesc = action === "approve"
        ? `[COMP APPROVED by ${req.user?.id}] ${reason ?? ""}`
        : `[COMP REJECTED by ${req.user?.id}] ${reason ?? ""}`;

      const { rowCount } = await pool.query(
        `UPDATE order_items SET description = description || $1 WHERE id = $2`,
        [" " + newDesc, id]
      );
      if (!rowCount) { res.status(404).json({ error: "ITEM_NOT_FOUND" }); return; }
      res.json({ message: `Comp ${action}d`, id });
    } catch (err) {
      console.error("[dash:mgr:comps]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// HOSTESS (own data only)
// ═════════════════════════════════════════════════════════════════════════════

const hostessOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER, ROLES.HOSTESS);

// GET /api/dashboards/hostess/summary
router.get(
  "/dashboards/hostess/summary",
  authenticate, hostessOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.substring(0, 7) + "-01";

      const [todayRes, mtdRes, sessRes, attRes] = await Promise.all([
        pool.query<Record<string, unknown>>(
          `SELECT COALESCE(SUM(net_payout), 0) AS today_commission
           FROM hostess_sessions hs
           JOIN hostess_profiles hp ON hp.id = hs.hostess_id
           WHERE hp.staff_id = $1 AND DATE(hs.start_at) = $2`,
          [staffId, today]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT COALESCE(SUM(net_payout), 0) AS mtd_commission,
                  COUNT(*) AS sessions_mtd
           FROM hostess_sessions hs
           JOIN hostess_profiles hp ON hp.id = hs.hostess_id
           WHERE hp.staff_id = $1 AND DATE(hs.start_at) >= $2`,
          [staffId, monthStart]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT hp.id, hp.status, s.full_name, s.employee_code
           FROM hostess_profiles hp
           JOIN staff s ON s.id = hp.staff_id
           WHERE hp.staff_id = $1 LIMIT 1`,
          [staffId]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT
             COUNT(*) FILTER (WHERE a.status = 'present') AS present_days,
             COUNT(*) AS total_days
           FROM attendance a
           WHERE a.staff_id = $1 AND a.work_date >= $2`,
          [staffId, monthStart]
        ),
      ]);

      const att = attRes.rows[0] ?? {};
      const presentDays = parseInt(att.present_days as string ?? "0", 10);
      const totalDays = parseInt(att.total_days as string ?? "1", 10);

      res.json({
        data: {
          profile: sessRes.rows[0] ?? {},
          today_commission: parseFloat(todayRes.rows[0]?.today_commission as string ?? "0"),
          mtd_commission: parseFloat(mtdRes.rows[0]?.mtd_commission as string ?? "0"),
          sessions_mtd: parseInt(mtdRes.rows[0]?.sessions_mtd as string ?? "0", 10),
          attendance_rate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
        },
      });
    } catch (err) {
      console.error("[dash:hostess:summary]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/hostess/commission
router.get(
  "/dashboards/hostess/commission",
  authenticate, hostessOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           hs.id, hs.start_at, hs.end_at, hs.hours_worked,
           hs.rate_per_hour, hs.gross_amount, hs.payout_rate, hs.net_payout,
           hs.late_charge_amount, hs.currency, hs.session_type,
           r.reservation_no, rm.name AS room_name
         FROM hostess_sessions hs
         JOIN hostess_profiles hp ON hp.id = hs.hostess_id
         LEFT JOIN reservations r ON r.id = hs.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE hp.staff_id = $1
         ORDER BY hs.start_at DESC
         LIMIT 50`,
        [staffId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:hostess:commission]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/hostess/schedule
router.get(
  "/dashboards/hostess/schedule",
  authenticate, hostessOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT ss.day_of_week, ss.shift_start, ss.shift_end, ss.is_overnight,
                ss.effective_from, ss.effective_to, b.name AS branch_name
         FROM staff_schedules ss
         LEFT JOIN branches b ON b.id = ss.branch_id
         WHERE ss.staff_id = $1
           AND (ss.effective_to IS NULL OR ss.effective_to >= CURRENT_DATE)
         ORDER BY ss.day_of_week`,
        [staffId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:hostess:schedule]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER (own data only, no PII)
// ═════════════════════════════════════════════════════════════════════════════

const driverAccess = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER, ROLES.DRIVER);

// GET /api/dashboards/driver/jobs
router.get(
  "/dashboards/driver/jobs",
  authenticate, driverAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const isDriver = user.role === ROLES.DRIVER;

      const params: unknown[] = [];
      const conditions = ["rp.status != 'cancelled'"];
      if (isDriver) {
        conditions.push(`rp.driver_id = $${(params.push(user.id), params.length)}`);
      }

      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           rp.id,
           rp.pickup_time,
           rp.return_time,
           rp.status,
           rp.notes,
           rp.pickup_address,
           rp.return_address,
           s.full_name AS driver_name,
           b.name      AS branch_name
         FROM reservation_pickups rp
         LEFT JOIN staff    s ON s.id  = rp.driver_id
         LEFT JOIN reservations r ON r.id = rp.reservation_id
         LEFT JOIN branches  b ON b.id = r.branch_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY rp.pickup_time ASC
         LIMIT 60`,
        params
      );

      const today = new Date().toISOString().split("T")[0];
      const tripsToday = rows.filter(j => {
        const pt = j.pickup_time;
        if (!pt) return false;
        const pts = pt instanceof Date ? pt.toISOString() : String(pt);
        return pts.startsWith(today);
      }).length;

      res.json({
        data: rows,
        summary: {
          trips_today: tripsToday,
          pending: rows.filter(j => j.status === "scheduled").length,
          active: rows.filter(j => j.status === "en_route" || j.status === "arrived").length,
          completed: rows.filter(j => j.status === "completed").length,
        },
      });
    } catch (err) {
      console.error("[dash:driver:jobs]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// KITCHEN
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/dashboards/kitchen/orders
router.get(
  "/dashboards/kitchen/orders",
  authenticate, kitchenAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      const params: unknown[] = [];
      const clause = branchId ? `AND o.branch_id = $${(params.push(branchId), params.length)}` : "";
      const today = new Date().toISOString().split("T")[0];

      const { rows: orders } = await pool.query<Record<string, unknown>>(
        `SELECT
           o.id, o.created_at, o.payment_status,
           rm.name AS room_name,
           r.reservation_no,
           json_agg(json_build_object(
             'id', oi.id,
             'description', oi.description,
             'quantity', oi.quantity,
             'item_type', oi.item_type
           ) ORDER BY oi.created_at) AS items
         FROM orders o
         LEFT JOIN reservations r ON r.id = o.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         JOIN order_items oi ON oi.order_id = o.id
           AND oi.item_type = 'product'
         WHERE DATE(o.created_at) = $${(params.push(today), params.length)} ${clause}
           AND o.payment_status != 'voided'
         GROUP BY o.id, rm.name, r.reservation_no
         ORDER BY o.created_at DESC
         LIMIT 80`,
        params
      );

      const countParams = branchId ? [today, branchId] : [today];
      const countClause = branchId ? "AND o.branch_id = $2" : "";
      const { rows: summary } = await pool.query<Record<string, unknown>>(
        `SELECT
           COUNT(*) FILTER (WHERE o.payment_status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE o.payment_status = 'partial') AS preparing,
           COUNT(*) FILTER (WHERE o.payment_status = 'paid')    AS completed
         FROM orders o
         WHERE DATE(o.created_at) = $1 ${countClause}`,
        countParams
      );

      res.json({ data: orders, summary: summary[0] ?? {} });
    } catch (err) {
      console.error("[dash:kitchen:orders]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/dashboards/kitchen/orders/:id/status
const KITCHEN_TRANSITIONS: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "done",
};

router.patch(
  "/dashboards/kitchen/orders/:id/status",
  authenticate, kitchenAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: string };
      const validStatuses = Object.values(KITCHEN_TRANSITIONS);
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "INVALID_TRANSITION", allowed: validStatuses });
        return;
      }
      // Map kitchen statuses to payment_status equivalents
      const payStatusMap: Record<string, string> = {
        preparing: "partial",
        ready: "partial",
        done: "paid",
      };
      const newPayStatus = payStatusMap[status] ?? "pending";
      const { rowCount } = await pool.query(
        `UPDATE orders SET payment_status = $1 WHERE id = $2`,
        [newPayStatus, id]
      );
      if (!rowCount) { res.status(404).json({ error: "ORDER_NOT_FOUND" }); return; }
      res.json({ message: "Status updated", id, kitchen_status: status });
    } catch (err) {
      console.error("[dash:kitchen:status]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// HALL
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/dashboards/hall/tasks
// Tasks = pending service orders for the branch
router.get(
  "/dashboards/hall/tasks",
  authenticate, hallAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = branchOf(req) ?? (req.query["branch_id"] as string);
      const params: unknown[] = [];
      const clause = branchId ? `AND o.branch_id = $${(params.push(branchId), params.length)}` : "";
      const today = new Date().toISOString().split("T")[0];

      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           oi.id, oi.description, oi.quantity, oi.item_type, oi.created_at,
           o.id AS order_id,
           rm.name AS room_name,
           r.reservation_no,
           CASE WHEN oi.item_type = 'room_charge' THEN 'high'
                WHEN oi.item_type = 'other' THEN 'low'
                ELSE 'normal' END AS priority
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN reservations r ON r.id = o.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE o.payment_status = 'pending'
           AND DATE(oi.created_at) = $${(params.push(today), params.length)} ${clause}
         ORDER BY
           CASE WHEN oi.item_type = 'room_charge' THEN 0 ELSE 1 END,
           oi.created_at ASC
         LIMIT 100`,
        params
      );

      res.json({
        data: rows,
        summary: {
          open: rows.length,
          high_priority: rows.filter(t => t.priority === "high").length,
        },
      });
    } catch (err) {
      console.error("[dash:hall:tasks]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/dashboards/hall/tasks/:id/done
router.patch(
  "/dashboards/hall/tasks/:id/done",
  authenticate, hallAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      // Mark by appending "[DONE]" to description
      const { rowCount } = await pool.query(
        `UPDATE order_items SET description = description || ' [DONE]'
         WHERE id = $1 AND description NOT LIKE '%[DONE]%'`,
        [id]
      );
      if (!rowCount) { res.status(404).json({ error: "TASK_NOT_FOUND_OR_ALREADY_DONE" }); return; }
      res.json({ message: "Task marked done", id });
    } catch (err) {
      console.error("[dash:hall:done]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GENERAL (own data only)
// ═════════════════════════════════════════════════════════════════════════════

const generalAccess = requireRole(
  ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER,
  ROLES.HOSTESS, ROLES.DRIVER, ROLES.KITCHEN, ROLES.HALL, ROLES.GENERAL
);

// GET /api/dashboards/general/timesheet
router.get(
  "/dashboards/general/timesheet",
  authenticate, generalAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const { rows } = await pool.query<Record<string, unknown>>(
        `SELECT
           a.id, a.work_date, a.clock_in, a.clock_out, a.status,
           a.late_minutes, a.early_leave_min, a.penalty_amount,
           ss.shift_start, ss.shift_end,
           CASE WHEN a.clock_in IS NOT NULL AND a.clock_out IS NOT NULL
                THEN ROUND(EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600.0, 2)
                ELSE NULL END AS hours_worked
         FROM attendance a
         LEFT JOIN staff_schedules ss ON ss.staff_id = a.staff_id
           AND ss.day_of_week = EXTRACT(DOW FROM a.work_date)::int
           AND ss.effective_from <= a.work_date
           AND (ss.effective_to IS NULL OR ss.effective_to >= a.work_date)
         WHERE a.staff_id = $1
           AND a.work_date >= CURRENT_DATE - INTERVAL '14 days'
         ORDER BY a.work_date DESC`,
        [staffId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[dash:general:timesheet]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/dashboards/general/pay-estimate
router.get(
  "/dashboards/general/pay-estimate",
  authenticate, generalAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const monthStart = new Date().toISOString().substring(0, 7) + "-01";

      const [staffRes, attRes] = await Promise.all([
        pool.query<Record<string, unknown>>(
          `SELECT full_name, role, employee_code, base_salary, salary_currency
           FROM staff WHERE id = $1 LIMIT 1`,
          [staffId]
        ),
        pool.query<Record<string, unknown>>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'present') AS present_days,
             COUNT(*) FILTER (WHERE status = 'late')    AS late_days,
             COUNT(*) FILTER (WHERE status = 'absent')  AS absent_days,
             COALESCE(SUM(penalty_amount), 0)           AS total_penalty,
             COALESCE(SUM(
               CASE WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0
                    ELSE 0 END
             ), 0) AS total_hours
           FROM attendance
           WHERE staff_id = $1 AND work_date >= $2`,
          [staffId, monthStart]
        ),
      ]);

      const staff = staffRes.rows[0] ?? {};
      const att = attRes.rows[0] ?? {};
      const baseSalary = parseFloat(staff.base_salary as string ?? "0");
      const penalty = parseFloat(att.total_penalty as string ?? "0");
      const estimatedNet = Math.max(0, baseSalary - penalty);

      res.json({
        data: {
          staff: { name: staff.full_name, role: staff.role, employee_code: staff.employee_code },
          payroll: {
            base_salary: baseSalary,
            currency: staff.salary_currency ?? "MYR",
            penalty_deduction: penalty,
            estimated_net: estimatedNet,
          },
          attendance: {
            present_days: parseInt(att.present_days as string ?? "0", 10),
            late_days: parseInt(att.late_days as string ?? "0", 10),
            absent_days: parseInt(att.absent_days as string ?? "0", 10),
            total_hours: parseFloat(att.total_hours as string ?? "0"),
          },
        },
      });
    } catch (err) {
      console.error("[dash:general:pay]", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
