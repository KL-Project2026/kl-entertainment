import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";

const router: IRouter = Router();

// GET /attendance/staff/:id?month=YYYY-MM
router.get(
  "/attendance/staff/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { month } = req.query as Record<string, string>;
    try {
      let q = `SELECT a.*, s.full_name
               FROM attendance a
               JOIN staff s ON s.id = a.staff_id
               WHERE a.staff_id = $1`;
      const params: unknown[] = [id];
      if (month) {
        params.push(month);
        q += ` AND TO_CHAR(a.work_date, 'YYYY-MM') = $${params.length}`;
      }
      q += " ORDER BY a.work_date DESC LIMIT 100";
      const { rows } = await pool.query(q, params);
      res.json({ data: rows });
    } catch (err) {
      console.error("attendance list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /attendance/summary/:staffId?month=YYYY-MM
router.get(
  "/attendance/summary/:staffId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { staffId } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    try {
      const { rows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'present')  AS present_days,
           COUNT(*) FILTER (WHERE status = 'absent')   AS absent_days,
           COUNT(*) FILTER (WHERE status = 'late')     AS late_days,
           COUNT(*) FILTER (WHERE status = 'early_leave') AS early_leave_days,
           COALESCE(SUM(hours_worked), 0)              AS total_hours,
           COALESCE(SUM(late_minutes), 0)              AS total_late_minutes,
           COALESCE(SUM(penalty_amount), 0)            AS total_penalty
         FROM attendance
         WHERE staff_id = $1
           AND TO_CHAR(work_date, 'YYYY-MM') = $2`,
        [staffId, month]
      );
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("attendance summary error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /attendance/clock-in
// Admin-driven clock-in. Accepts optional GPS coords (additive — RULE D)
router.post(
  "/attendance/clock-in",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;
    const staff_id  = body["staff_id"] as string | undefined;
    const notes     = body["notes"] as string | undefined;
    const latitude  = body["latitude"] != null ? Number(body["latitude"]) : null;
    const longitude = body["longitude"] != null ? Number(body["longitude"]) : null;
    const today = new Date().toISOString().split("T")[0];
    try {
      if (!staff_id) {
        res.status(400).json({ error: "staff_id is required" });
        return;
      }
      // check existing
      const existing = await pool.query(
        `SELECT id, clock_in, clock_out FROM attendance
         WHERE staff_id = $1 AND work_date = $2`,
        [staff_id, today]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({
          error: "Attendance record already exists for today.",
          attendance_id: (existing.rows[0] as Record<string, unknown>).id,
        });
        return;
      }
      // get staff branch_id
      const staffRow = await pool.query(
        `SELECT branch_id FROM staff WHERE id = $1`,
        [staff_id]
      );
      if (!staffRow.rows.length) {
        res.status(404).json({ error: "STAFF_NOT_FOUND" });
        return;
      }
      const branch_id = (staffRow.rows[0] as Record<string, unknown>).branch_id;
      // GPS is supplementary — null if not provided (RULE D)
      const lat = latitude != null && !isNaN(latitude) ? latitude : null;
      const lng = longitude != null && !isNaN(longitude) ? longitude : null;
      const { rows } = await pool.query(
        `INSERT INTO attendance
           (staff_id, branch_id, work_date, clock_in, status, notes,
            gps_lat_in, gps_lng_in, clock_in_source)
         VALUES ($1, $2, $3, NOW(), 'present', $4, $5, $6, 'admin')
         RETURNING *`,
        [staff_id, branch_id, today, notes ?? null, lat, lng]
      );
      res.json({ success: true, data: rows[0] });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "23505") {
        res.status(409).json({ error: "Duplicate attendance record." });
        return;
      }
      console.error("clock-in error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PUT /attendance/:id/clock-out
router.put(
  "/attendance/:id/clock-out",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE attendance
         SET clock_out = NOW()
         WHERE id = $1 AND clock_out IS NULL
         RETURNING *`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "No open clock-in record found or already clocked out." });
        return;
      }
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("clock-out error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /attendance/today/:staffId — today's record (for clock-in/out button state)
router.get(
  "/attendance/today/:staffId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { rows } = await pool.query(
        `SELECT * FROM attendance WHERE staff_id = $1 AND work_date = $2`,
        [req.params.staffId, today]
      );
      res.json({ data: rows[0] ?? null });
    } catch (err) {
      console.error("attendance today error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
