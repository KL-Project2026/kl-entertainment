import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticateCustomer } from "./customer-auth";

const router: IRouter = Router();

function auth(req: Request, res: Response, next: () => void) {
  return authenticateCustomer(req, res, next);
}

router.get("/customer/bookings", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { rows } = await pool.query<{
      id: string; reservation_no: string; status: string; start_time: Date;
      end_time: Date; guest_count: number; room_name: string; branch_name: string;
    }>(
      `SELECT r.id, r.reservation_no, r.status, r.start_time, r.end_time,
              r.guest_count, rm.name AS room_name, b.name AS branch_name
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
       JOIN branches b ON b.id = r.branch_id
       WHERE r.customer_id = $1
       ORDER BY r.start_time DESC
       LIMIT 50`,
      [customerId]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("[customer-bookings] list error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.get("/customer/bookings/:id", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { id } = req.params as { id: string };

    const { rows } = await pool.query<{
      id: string; reservation_no: string; status: string; start_time: Date;
      end_time: Date; guest_count: number; room_name: string; branch_name: string;
      notes: string;
    }>(
      `SELECT r.id, r.reservation_no, r.status, r.start_time, r.end_time,
              r.guest_count, r.special_requests AS notes, rm.name AS room_name, b.name AS branch_name
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
       JOIN branches b ON b.id = r.branch_id
       WHERE r.id = $1 AND r.customer_id = $2`,
      [id, customerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("[customer-bookings] detail error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/customer/bookings", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { branchId, roomId, startTime, endTime, guestCount = 2, notes } = req.body as {
      branchId: string; roomId: string; startTime: string;
      endTime: string; guestCount?: number; notes?: string;
    };

    if (!branchId || !roomId || !startTime || !endTime) {
      res.status(400).json({ error: "MISSING_FIELDS" }); return;
    }

    const conflict = await pool.query(
      `SELECT id FROM reservations
       WHERE room_id = $1
         AND status NOT IN ('cancelled', 'no_show', 'checked_out')
         AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)`,
      [roomId, startTime, endTime]
    );
    if ((conflict.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "ROOM_NOT_AVAILABLE" }); return;
    }

    const resNo = `RES-${Date.now().toString(36).toUpperCase()}`;
    const { rows } = await pool.query<{
      id: string; reservation_no: string; status: string; start_time: Date; end_time: Date;
    }>(
      `INSERT INTO reservations
         (branch_id, room_id, customer_id, reservation_no, status, start_time, end_time,
          guest_count, booking_channel, special_requests)
       VALUES ($1, $2, $3, $4, 'tentative', $5, $6, $7, 'customer_app', $8)
       RETURNING id, reservation_no, status, start_time, end_time`,
      [branchId, roomId, customerId, resNo, startTime, endTime, guestCount, notes ?? null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error("[customer-bookings] create error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.put("/customer/bookings/:id/cancel", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { id } = req.params as { id: string };

    const { rowCount } = await pool.query(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND customer_id = $2
         AND status IN ('tentative', 'confirmed')`,
      [id, customerId]
    );
    if (!rowCount) { res.status(400).json({ error: "CANNOT_CANCEL" }); return; }
    res.json({ data: { id, status: "cancelled" } });
  } catch (err) {
    console.error("[customer-bookings] cancel error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
