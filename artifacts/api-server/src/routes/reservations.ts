import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole, requireBranchAccess } from "../middleware/rbac";
import { ROLES, VALID_TRANSITIONS } from "../config/constants";
import { transitionStatus, validateOutcallDriverAssigned, generateReservationNo } from "../services/reservation-service";
import { sendBookingConfirmation } from "../services/whatsapp-service";

const router: IRouter = Router();

function formatReservation(row: Record<string, unknown>) {
  return {
    id: row.id,
    reservationNo: row.reservation_no,
    branchId: row.branch_id,
    customerId: row.customer_id ?? null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    guestCount: row.guest_count,
    reservationDate: row.reservation_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationHours: row.duration_hours ? parseFloat(row.duration_hours as string) : null,
    roomId: row.room_id ?? null,
    roomName: row.room_name ?? null,
    roomType: row.room_type ?? null,
    status: row.status,
    bookingChannel: row.booking_channel,
    isOutcall: row.is_outcall,
    specialRequests: row.special_requests ?? null,
    depositAmount: row.deposit_amount ? parseFloat(row.deposit_amount as string) : 0,
    depositPaid: row.deposit_paid,
    depositMethod: row.deposit_method ?? null,
    confirmedAt: row.confirmed_at ?? null,
    checkedInAt: row.checked_in_at ?? null,
    checkedOutAt: row.checked_out_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    createdAt: row.created_at,
  };
}

// List reservations
router.get(
  "/reservations",
  authenticate,
  requireBranchAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, date, status } = req.query as Record<string, string>;

      const isSuperUser = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user!.role as typeof ROLES[keyof typeof ROLES]);
      const effectiveBranchId = branch_id ?? (!isSuperUser ? req.user!.branchId! : undefined);

      const conditions: string[] = ["1=1"];
      const params: unknown[] = [];

      if (effectiveBranchId) {
        params.push(effectiveBranchId);
        conditions.push(`r.branch_id = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`r.reservation_date = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }

      const { rows } = await pool.query(
        `SELECT r.*, rm.name AS room_name, rm.room_type
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY r.start_time DESC
         LIMIT 200`,
        params
      );

      res.json({ data: rows.map(formatReservation) });
    } catch (err) {
      console.error("List reservations error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create reservation
router.post(
  "/reservations",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      const { rows: branchRows } = await pool.query(
        "SELECT internal_code FROM branches WHERE id = $1",
        [body.branchId]
      );
      if (!branchRows.length) {
        res.status(404).json({ error: "BRANCH_NOT_FOUND" });
        return;
      }
      const branchCode = (branchRows[0] as { internal_code: string }).internal_code;
      const reservationNo = await generateReservationNo(branchCode);

      const reservationDate = body.reservationDate ?? (body.startTime as string).split("T")[0];

      const { rows } = await pool.query(
        `INSERT INTO reservations (
           id, reservation_no, branch_id, customer_id, customer_name, customer_phone,
           guest_count, reservation_date, start_time, end_time, duration_hours,
           room_id, status, booking_channel, is_outcall, special_requests,
           deposit_amount, deposit_paid, deposit_method, created_by
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           $11, 'tentative', $12, $13, $14,
           $15, $16, $17, $18
         ) RETURNING *`,
        [
          reservationNo, body.branchId, body.customerId ?? null, body.customerName ?? null, body.customerPhone ?? null,
          body.guestCount ?? 1, reservationDate, body.startTime, body.endTime ?? null, body.durationHours ?? null,
          body.roomId ?? null, body.bookingChannel ?? "walk_in", body.isOutcall ?? false, body.specialRequests ?? null,
          body.depositAmount ?? 0, body.depositPaid ?? false, body.depositMethod ?? null, req.user!.id,
        ]
      );

      // Assign hostesses if provided
      if (Array.isArray(body.hostessIds) && (body.hostessIds as string[]).length > 0) {
        for (const hostessId of body.hostessIds as string[]) {
          await pool.query(
            `INSERT INTO reservation_hostesses (id, reservation_id, hostess_id, assigned_by, assigned_at)
             VALUES (gen_random_uuid(), $1, $2, $3, now())`,
            [(rows[0] as Record<string, unknown>).id, hostessId, req.user!.id]
          );
        }
      }

      res.status(201).json({ data: formatReservation(rows[0]) });
    } catch (err) {
      console.error("Create reservation error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get reservation
router.get(
  "/reservations/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT r.*, rm.name AS room_name, rm.room_type FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id WHERE r.id = $1`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }

      const reservation = formatReservation(rows[0]);

      // Fetch hostesses
      const { rows: hostesses } = await pool.query(
        `SELECT rh.*, s.full_name FROM reservation_hostesses rh
         JOIN staff s ON s.id = rh.hostess_id
         WHERE rh.reservation_id = $1`,
        [req.params.id]
      );

      res.json({ data: { ...reservation, hostesses } });
    } catch (err) {
      console.error("Get reservation error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Confirm reservation
router.put(
  "/reservations/:id/confirm",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query("SELECT is_outcall FROM reservations WHERE id = $1", [req.params.id]);
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      if ((rows[0] as { is_outcall: boolean }).is_outcall) {
        try { await validateOutcallDriverAssigned(req.params.id); } catch {
          res.status(422).json({ error: "DRIVER_REQUIRED_FOR_OUTCALL" }); return;
        }
      }

      const updated = await transitionStatus(req.params.id, "confirmed", req.user!.id);
      res.json({ data: formatReservation(updated) });

      if (updated.customer_phone) {
        const lang = (updated.customer_language_pref as string | undefined) ?? "en";
        sendBookingConfirmation({
          reservation_no: updated.reservation_no as string,
          start_time: String(updated.start_time),
          room_name: updated.room_name as string ?? "",
          guest_count: updated.guest_count as number,
          customer_phone: updated.customer_phone as string,
        }, lang).catch((err) => console.error("[whatsapp] confirmation send failed:", err));
      }
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TRANSITION")) res.status(422).json({ error: msg });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Check-in
router.put(
  "/reservations/:id/check-in",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await transitionStatus(req.params.id, "checked_in", req.user!.id);
      res.json({ data: formatReservation(updated) });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TRANSITION")) res.status(422).json({ error: msg });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Extend stay
router.put(
  "/reservations/:id/extend",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { extra_hours } = req.body as { extra_hours: number };
      if (!extra_hours || extra_hours <= 0) {
        res.status(400).json({ error: "INVALID_EXTRA_HOURS" }); return;
      }
      const updated = await transitionStatus(req.params.id, "extended", req.user!.id, { extra_hours });
      res.json({ data: formatReservation(updated) });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TRANSITION")) res.status(422).json({ error: msg });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Check-out
router.put(
  "/reservations/:id/check-out",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await transitionStatus(req.params.id, "checked_out", req.user!.id);
      res.json({ data: formatReservation(updated) });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TRANSITION")) res.status(422).json({ error: msg });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Cancel
router.put(
  "/reservations/:id/cancel",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      const updated = await transitionStatus(req.params.id, "cancelled", req.user!.id, { reason });
      res.json({ data: formatReservation(updated) });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.startsWith("INVALID_TRANSITION")) res.status(422).json({ error: msg });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Availability check
router.get(
  "/reservations/availability",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, date, duration_hours } = req.query as Record<string, string>;

      const { rows } = await pool.query(
        `SELECT rm.* FROM rooms rm
         WHERE rm.branch_id = $1 AND rm.is_active = true AND rm.deleted_at IS NULL
         AND rm.id NOT IN (
           SELECT r.room_id FROM reservations r
           WHERE r.branch_id = $1
             AND r.reservation_date = $2
             AND r.status NOT IN ('cancelled', 'no_show')
             AND r.room_id IS NOT NULL
         )
         ORDER BY rm.sort_order, rm.name`,
        [branch_id, date]
      );

      res.json({ data: rows });
    } catch (err) {
      console.error("Availability error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
