import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// Access: self-service for hostess + read access for managers/admins
const hostessAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
  ROLES.HOSTESS,
);

// ── GET /hostess/my-assignments ────────────────────────────────────────────
// Returns reservation_hostesses for the caller (self-only for hostess role)
// Managers can pass ?staff_id=<uuid> to view a specific hostess
router.get(
  "/hostess/my-assignments",
  authenticate,
  hostessAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role   = req.user!.role;
      const selfId = req.user!.id;
      const isAdmin = ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER] as string[]).includes(role);

      // For non-admin, always restrict to self
      const targetId: string = isAdmin
        ? ((req.query["staff_id"] as string | undefined) ?? selfId)
        : selfId;

      const { rows } = await pool.query(
        `SELECT
           rh.id,
           rh.reservation_id,
           rh.status,
           rh.is_primary,
           rh.session_fee,
           rh.assigned_at,
           r.reservation_no,
           r.start_time,
           r.end_time,
           r.guest_count,
           rm.name  AS room_name,
           rm.id    AS room_id
         FROM reservation_hostesses rh
         JOIN reservations r  ON r.id  = rh.reservation_id
         LEFT JOIN rooms    rm ON rm.id = r.room_id
         WHERE rh.hostess_id = $1
           AND r.deleted_at IS NULL
         ORDER BY rh.assigned_at DESC
         LIMIT 50`,
        [targetId]
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[Hostess] my-assignments error:", err);
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  }
);

// ── GET /hostess/my-commissions ─────────────────────────────────────────────
// Returns hostess_sessions — self-only for hostess role
// customer_name intentionally omitted (privacy)
router.get(
  "/hostess/my-commissions",
  authenticate,
  hostessAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role    = req.user!.role;
      const selfId  = req.user!.id;
      const period  = req.query["period"] as string | undefined;
      const isAdmin = ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER] as string[]).includes(role);

      const targetId: string = isAdmin
        ? ((req.query["staff_id"] as string | undefined) ?? selfId)
        : selfId;

      const whereParts: string[] = ["hs.hostess_id = $1"];
      const params: unknown[]    = [targetId];
      let pIdx = 2;

      if (period) {
        whereParts.push(`TO_CHAR(hs.start_at, 'YYYY-MM') = $${pIdx++}`);
        params.push(period);
      } else {
        whereParts.push("hs.start_at >= NOW() - INTERVAL '3 months'");
      }

      const { rows } = await pool.query(
        `SELECT
           hs.id,
           hs.start_at,
           hs.end_at,
           hs.hours_worked,
           hs.rate_per_hour,
           hs.gross_amount,
           hs.payout_rate,
           hs.net_payout,
           hs.late_charge_amount,
           hs.currency,
           hs.status,
           r.reservation_no,
           rm.name    AS room_name,
           NULL::text AS customer_name
         FROM hostess_sessions hs
         JOIN reservations r  ON r.id  = hs.reservation_id
         LEFT JOIN rooms   rm ON rm.id = r.room_id
         WHERE ${whereParts.join(" AND ")}
         ORDER BY hs.start_at DESC
         LIMIT 100`,
        params
      );

      const totalNetPayout = rows.reduce(
        (sum, r) => sum + parseFloat(String(r.net_payout ?? 0)),
        0
      );

      res.json({
        data:             rows,
        count:            rows.length,
        total_net_payout: totalNetPayout,
        currency:         "MYR",
      });
    } catch (err) {
      console.error("[Hostess] my-commissions error:", err);
      res.status(500).json({ error: "Failed to fetch commissions" });
    }
  }
);

// ── GET /hostess/today-status ───────────────────────────────────────────────
// Returns today's attendance clock status for the calling hostess
router.get(
  "/hostess/today-status",
  authenticate,
  hostessAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const today   = new Date().toISOString().split("T")[0];

      const { rows } = await pool.query(
        `SELECT id, clock_in, clock_out, status, hours_worked,
                gps_lat_in, gps_lng_in, gps_lat_out, gps_lng_out
         FROM attendance
         WHERE staff_id = $1 AND work_date = $2`,
        [staffId, today]
      );

      res.json({ data: rows[0] ?? null, date: today });
    } catch (err) {
      console.error("[Hostess] today-status error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── POST /hostess/clock-in ─────────────────────────────────────────────────
// Self-service clock-in with optional GPS coordinates
// GPS failure does NOT block clock-in (RULE D compliant)
// Separate from /attendance/clock-in (admin-driven) — this is self-service
router.post(
  "/hostess/clock-in",
  authenticate,
  hostessAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const today   = new Date().toISOString().split("T")[0];
      const { latitude, longitude, notes } = req.body as {
        latitude?: number | null;
        longitude?: number | null;
        notes?: string;
      };

      // Prevent double clock-in for same day
      const existing = await pool.query(
        `SELECT id, clock_in, clock_out FROM attendance
         WHERE staff_id = $1 AND work_date = $2`,
        [staffId, today]
      );
      if (existing.rows.length > 0) {
        const rec = existing.rows[0] as Record<string, unknown>;
        if (rec["clock_in"] && !rec["clock_out"]) {
          // Already clocked in and not yet out
          res.status(409).json({
            error: "Already clocked in. Please clock out first.",
            attendance_id: rec["id"],
            clock_in: rec["clock_in"],
          });
          return;
        }
      }

      // Get staff branch_id
      const staffRow = await pool.query(
        `SELECT branch_id FROM staff WHERE id = $1 AND deleted_at IS NULL`,
        [staffId]
      );
      if (!staffRow.rows.length) {
        res.status(404).json({ error: "STAFF_NOT_FOUND" });
        return;
      }
      const branchId = (staffRow.rows[0] as Record<string, unknown>)["branch_id"] as string;

      // GPS is supplementary — null if not provided or failed on client
      const lat = (latitude != null && !isNaN(Number(latitude))) ? Number(latitude) : null;
      const lng = (longitude != null && !isNaN(Number(longitude))) ? Number(longitude) : null;

      const { rows } = await pool.query(
        `INSERT INTO attendance
           (staff_id, branch_id, work_date, clock_in, status,
            gps_lat_in, gps_lng_in, clock_in_source, notes)
         VALUES ($1, $2, $3, NOW(), 'present', $4, $5, 'self_service', $6)
         ON CONFLICT (staff_id, work_date) DO UPDATE
           SET clock_in        = COALESCE(attendance.clock_in, NOW()),
               gps_lat_in      = COALESCE(attendance.gps_lat_in, EXCLUDED.gps_lat_in),
               gps_lng_in      = COALESCE(attendance.gps_lng_in, EXCLUDED.gps_lng_in),
               clock_in_source = COALESCE(attendance.clock_in_source, 'self_service'),
               status          = CASE WHEN attendance.clock_in IS NULL THEN 'present' ELSE attendance.status END
         RETURNING id, clock_in, status`,
        [staffId, branchId, today, lat, lng, notes ?? null]
      );

      res.json({
        success:       true,
        message:       "Clocked in successfully",
        attendance_id: (rows[0] as Record<string, unknown>)["id"],
        clock_in:      (rows[0] as Record<string, unknown>)["clock_in"],
        gps_captured:  lat !== null && lng !== null,
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "23505") {
        res.status(409).json({ error: "Already clocked in today." });
        return;
      }
      console.error("[Hostess] clock-in error:", err);
      res.status(500).json({ error: "Clock-in failed. Please try again." });
    }
  }
);

// ── POST /hostess/clock-out ────────────────────────────────────────────────
// Self-service clock-out with optional GPS
router.post(
  "/hostess/clock-out",
  authenticate,
  hostessAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const staffId = req.user!.id;
      const today   = new Date().toISOString().split("T")[0];
      const { latitude, longitude } = req.body as {
        latitude?: number | null;
        longitude?: number | null;
      };

      const lat = (latitude != null && !isNaN(Number(latitude))) ? Number(latitude) : null;
      const lng = (longitude != null && !isNaN(Number(longitude))) ? Number(longitude) : null;

      const { rows } = await pool.query(
        `UPDATE attendance
         SET clock_out     = NOW(),
             gps_lat_out   = COALESCE($2, gps_lat_out),
             gps_lng_out   = COALESCE($3, gps_lng_out)
         WHERE staff_id = $1
           AND work_date = $4
           AND clock_out IS NULL
         RETURNING id, clock_in, clock_out, hours_worked`,
        [staffId, lat, lng, today]
      );

      if (!rows.length) {
        res.status(404).json({ error: "No open clock-in record found for today." });
        return;
      }

      const rec = rows[0] as Record<string, unknown>;
      res.json({
        success:       true,
        message:       "Clocked out successfully",
        attendance_id: rec["id"],
        clock_in:      rec["clock_in"],
        clock_out:     rec["clock_out"],
        hours_worked:  rec["hours_worked"],
        gps_captured:  lat !== null && lng !== null,
      });
    } catch (err) {
      console.error("[Hostess] clock-out error:", err);
      res.status(500).json({ error: "Clock-out failed. Please try again." });
    }
  }
);

export default router;
