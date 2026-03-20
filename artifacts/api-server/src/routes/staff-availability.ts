import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";

const router: IRouter = Router();

// Available hostesses for a time slot
router.get(
  "/staff/hostesses/available",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, date, start_time } = req.query as Record<string, string>;

      if (!branch_id) { res.status(400).json({ error: "BRANCH_ID_REQUIRED" }); return; }

      const { rows } = await pool.query(
        `SELECT s.id, s.full_name, s.profile_photo, s.role
         FROM staff s
         WHERE s.branch_id = $1
           AND s.role = 'hostess'
           AND s.is_active = true
           AND s.deleted_at IS NULL
           AND s.id NOT IN (
             SELECT rh.hostess_id FROM reservation_hostesses rh
             JOIN reservations r ON r.id = rh.reservation_id
             WHERE r.branch_id = $1
               AND r.reservation_date = $2
               AND r.status NOT IN ('cancelled', 'no_show', 'checked_out')
           )
         ORDER BY s.full_name`,
        [branch_id, date ?? new Date().toISOString().split("T")[0]]
      );

      res.json({
        data: rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: row.id,
            name: row.full_name,
            profilePhoto: row.profile_photo ?? null,
            role: row.role,
            rating: 5.0,
          };
        }),
      });
    } catch (err) {
      console.error("Hostesses available error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Available drivers for a time slot
router.get(
  "/staff/drivers/available",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, date, pickup_time } = req.query as Record<string, string>;

      if (!branch_id) { res.status(400).json({ error: "BRANCH_ID_REQUIRED" }); return; }

      const { rows } = await pool.query(
        `SELECT s.id, s.full_name, s.profile_photo, s.role
         FROM staff s
         WHERE s.branch_id = $1
           AND s.role = 'driver'
           AND s.is_active = true
           AND s.deleted_at IS NULL
           AND s.id NOT IN (
             SELECT rp.driver_id FROM reservation_pickups rp
             JOIN reservations r ON r.id = rp.reservation_id
             WHERE r.branch_id = $1
               AND r.reservation_date = $2
               AND r.status NOT IN ('cancelled', 'no_show', 'checked_out')
               AND rp.status != 'cancelled'
               AND rp.driver_id IS NOT NULL
           )
         ORDER BY s.full_name`,
        [branch_id, date ?? new Date().toISOString().split("T")[0]]
      );

      res.json({
        data: rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: row.id,
            name: row.full_name,
            profilePhoto: row.profile_photo ?? null,
            role: row.role,
          };
        }),
      });
    } catch (err) {
      console.error("Drivers available error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
