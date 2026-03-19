import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

function formatSchedule(row: Record<string, unknown>) {
  return {
    id: row.id,
    staffId: row.staff_id,
    branchId: row.branch_id,
    staffName: row.full_name ?? null,
    staffRole: row.role ?? null,
    dayOfWeek: row.day_of_week,
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,
    isOvernight: row.is_overnight ?? false,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? null,
    createdAt: row.created_at,
  };
}

// List schedules for a branch (weekly view)
router.get(
  "/schedules",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, staff_id, effective_date } = req.query as Record<string, string>;
      if (!branch_id) { res.status(400).json({ error: "BRANCH_ID_REQUIRED" }); return; }

      const dateRef = effective_date ?? new Date().toISOString().split("T")[0];

      const { rows } = await pool.query(
        `SELECT ss.*, s.full_name, s.role, s.employment_type
         FROM staff_schedules ss
         JOIN staff s ON s.id = ss.staff_id
         WHERE ss.branch_id = $1
           AND ss.effective_from <= $2
           AND (ss.effective_to IS NULL OR ss.effective_to >= $2)
           ${staff_id ? "AND ss.staff_id = $3" : ""}
           AND s.is_active = true AND s.deleted_at IS NULL
         ORDER BY s.role, s.full_name, ss.day_of_week`,
        staff_id ? [branch_id, dateRef, staff_id] : [branch_id, dateRef]
      );

      res.json({ data: (rows as Record<string, unknown>[]).map(formatSchedule) });
    } catch (err) {
      console.error("List schedules error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Upsert a single shift (create or replace)
router.post(
  "/schedules",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.staffId || body.dayOfWeek === undefined || !body.shiftStart || !body.shiftEnd || !body.effectiveFrom) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }

      // Get staff branch_id
      const { rows: staffRows } = await pool.query(
        "SELECT branch_id FROM staff WHERE id = $1",
        [body.staffId]
      );
      if (!staffRows.length) { res.status(404).json({ error: "STAFF_NOT_FOUND" }); return; }
      const branchId = (body.branchId as string) || (staffRows[0] as Record<string, string>).branch_id;

      // Close any existing schedule for this staff+day
      await pool.query(
        `UPDATE staff_schedules
         SET effective_to = $1::date - INTERVAL '1 day'
         WHERE staff_id = $2 AND day_of_week = $3
           AND effective_to IS NULL AND effective_from <= $1::date`,
        [body.effectiveFrom, body.staffId, body.dayOfWeek]
      );

      const { rows } = await pool.query(
        `INSERT INTO staff_schedules (staff_id, branch_id, day_of_week, shift_start, shift_end, is_overnight, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          body.staffId, branchId, body.dayOfWeek,
          body.shiftStart, body.shiftEnd,
          body.isOvernight ?? false,
          body.effectiveFrom, body.effectiveTo ?? null,
        ]
      );

      res.status(201).json({ data: formatSchedule(rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Create schedule error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Delete (clear) a specific schedule entry
router.delete(
  "/schedules/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        "DELETE FROM staff_schedules WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Bulk copy schedules to a new effective date (copy from previous week)
router.post(
  "/schedules/copy",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.branchId || !body.fromDate || !body.toDate) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }

      // Get active schedules from fromDate
      const { rows: sourceRows } = await pool.query(
        `SELECT * FROM staff_schedules ss
         JOIN staff s ON s.id = ss.staff_id
         WHERE ss.branch_id = $1
           AND ss.effective_from <= $2 AND (ss.effective_to IS NULL OR ss.effective_to >= $2)
           AND s.is_active = true AND s.deleted_at IS NULL`,
        [body.branchId, body.fromDate]
      );

      let count = 0;
      for (const row of sourceRows as Record<string, unknown>[]) {
        // Close existing at toDate
        await pool.query(
          `UPDATE staff_schedules
           SET effective_to = $1::date - INTERVAL '1 day'
           WHERE staff_id = $2 AND day_of_week = $3 AND effective_to IS NULL AND effective_from <= $1`,
          [body.toDate, row.staff_id, row.day_of_week]
        );
        await pool.query(
          `INSERT INTO staff_schedules (staff_id, branch_id, day_of_week, shift_start, shift_end, is_overnight, effective_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [row.staff_id, row.branch_id, row.day_of_week, row.shift_start, row.shift_end, row.is_overnight, body.toDate]
        );
        count++;
      }

      res.json({ data: { copied: count } });
    } catch (err) {
      console.error("Copy schedules error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
