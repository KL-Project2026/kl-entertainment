import { pool } from "@workspace/db";
import { VALID_TRANSITIONS } from "../config/constants";
import { emitRoomUpdate } from "../routes/rooms";

export interface ReservationTransitionExtra {
  reason?: string;
  extra_hours?: number;
}

export async function transitionStatus(
  reservationId: string,
  newStatus: string,
  userId: string,
  extra: ReservationTransitionExtra = {}
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    "SELECT * FROM reservations WHERE id = $1",
    [reservationId]
  );

  if (!rows.length) throw new Error("RESERVATION_NOT_FOUND");
  const reservation = rows[0] as Record<string, unknown>;

  const currentStatus = reservation.status as string;
  const allowed: string[] = (VALID_TRANSITIONS as Record<string, string[]>)[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(`INVALID_TRANSITION:${currentStatus}→${newStatus}`);
  }

  const now = new Date();

  let confirmedAt = reservation.confirmed_at;
  let checkedInAt = reservation.checked_in_at;
  let checkedOutAt = reservation.checked_out_at;
  let cancelledAt = reservation.cancelled_at;
  let cancellationReason = reservation.cancellation_reason;
  let noShowAt = reservation.no_show_at;
  let endTime = reservation.end_time;
  let durationHours = reservation.duration_hours;

  if (newStatus === "confirmed") confirmedAt = now;
  if (newStatus === "checked_in") checkedInAt = now;
  if (newStatus === "checked_out") checkedOutAt = now;
  if (newStatus === "cancelled") {
    cancelledAt = now;
    cancellationReason = extra.reason ?? null;
  }
  if (newStatus === "no_show") noShowAt = now;
  if (newStatus === "extended" && extra.extra_hours) {
    const currentEnd = new Date(reservation.end_time as string);
    endTime = new Date(currentEnd.getTime() + extra.extra_hours * 3_600_000);
    durationHours = Number(reservation.duration_hours || 0) + extra.extra_hours;
  }

  await pool.query(
    `UPDATE reservations
     SET status = $1, updated_at = $2,
         confirmed_at = $3, checked_in_at = $4, checked_out_at = $5,
         cancelled_at = $6, cancellation_reason = $7, no_show_at = $8,
         end_time = COALESCE($9, end_time),
         duration_hours = COALESCE($10, duration_hours)
     WHERE id = $11`,
    [
      newStatus, now,
      confirmedAt, checkedInAt, checkedOutAt,
      cancelledAt, cancellationReason, noShowAt,
      newStatus === "extended" ? endTime : null,
      newStatus === "extended" ? durationHours : null,
      reservationId,
    ]
  );

  const terminalOut = ["checked_out", "cancelled", "no_show"];
  const roomStatus = ["checked_in", "extended"].includes(newStatus)
    ? "occupied"
    : terminalOut.includes(newStatus)
    ? "available"
    : null;

  if (roomStatus && reservation.room_id) {
    await pool.query("UPDATE rooms SET status = $1 WHERE id = $2", [
      roomStatus,
      reservation.room_id,
    ]);

    emitRoomUpdate(reservation.branch_id as string, {
      id: reservation.room_id,
      branchId: reservation.branch_id,
      status: roomStatus,
      name: "",
      reservationNo: terminalOut.includes(newStatus) ? null : reservation.reservation_no,
      guestName: terminalOut.includes(newStatus) ? null : reservation.customer_name,
      guestCount: reservation.guest_count ?? null,
      checkInTime: checkedInAt ?? null,
      expectedCheckOut: endTime ?? null,
    });
  }

  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_values, new_values)
     VALUES ('reservation', $1, 'status_change', $2, $3, $4)`,
    [
      reservationId,
      userId,
      JSON.stringify({ status: currentStatus }),
      JSON.stringify({ status: newStatus }),
    ]
  );

  return { ...reservation, status: newStatus, confirmed_at: confirmedAt, checked_in_at: checkedInAt, checked_out_at: checkedOutAt, cancelled_at: cancelledAt, cancellation_reason: cancellationReason, no_show_at: noShowAt, end_time: endTime, duration_hours: durationHours };
}

export async function validateOutcallDriverAssigned(reservationId: string): Promise<void> {
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM reservation_pickups WHERE reservation_id = $1 AND status != 'cancelled'",
    [reservationId]
  );
  if (parseInt((rows[0] as Record<string, string>).count) === 0) {
    throw new Error("DRIVER_REQUIRED_FOR_OUTCALL");
  }
}

export async function generateReservationNo(branchCode: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM reservations WHERE reservation_date = CURRENT_DATE AND reservation_no LIKE $1`,
    [`${branchCode}-${today}-%`]
  );
  const seq = parseInt((rows[0] as Record<string, string>).count) + 1;
  return `${branchCode}-${today}-${String(seq).padStart(3, "0")}`;
}
