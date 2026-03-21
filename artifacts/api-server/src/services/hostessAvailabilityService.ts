// MIGRATION: .NET — IHostessAvailabilityService
import { pool } from "@workspace/db";

export type AvailabilityResult =
  | { available: true }
  | { available: false; reason: string; detail: Record<string, unknown> };

/**
 * Check whether a hostess can be assigned to a new session within the given time window.
 * Adapted to actual schema: hostess_profiles, staff_schedules, hostess_sessions, hostess_session_assignments
 */
export async function checkHostessAvailability(
  hostessProfileId: string,
  requiredFrom: Date,
  requiredUntil: Date,
  branchId: string,
  excludeAssignmentIds: string[] = []
): Promise<AvailabilityResult> {

  // 1. Fetch hostess profile — must be active and belong to (or allowed in) branch
  const { rows: profileRows } = await pool.query<{
    id: string; status: string; staff_id: string; agency_id: string | null;
  }>(
    `SELECT id, status, staff_id, agency_id
     FROM hostess_profiles
     WHERE id = $1 AND deleted_at IS NULL`,
    [hostessProfileId]
  );

  if (!profileRows.length) {
    return { available: false, reason: "NOT_SCHEDULED", detail: { message: "Hostess profile not found" } };
  }

  const profile = profileRows[0];
  if (profile.status !== "active") {
    return {
      available: false,
      reason: "NOT_SCHEDULED",
      detail: { message: `Hostess status is '${profile.status}' — not active` },
    };
  }

  // 2. Check staff_schedules for shift coverage on the required date
  const dayOfWeek = requiredFrom.getDay(); // 0=Sun
  const { rows: scheduleRows } = await pool.query<{
    shift_start: string; shift_end: string; is_overnight: boolean;
  }>(
    `SELECT shift_start, shift_end, is_overnight
     FROM staff_schedules
     WHERE staff_id = $1
       AND branch_id = $2
       AND day_of_week = $3
       AND effective_from <= $4::date
       AND (effective_to IS NULL OR effective_to >= $4::date)
     LIMIT 1`,
    [profile.staff_id, branchId, dayOfWeek, requiredFrom.toISOString()]
  );

  if (!scheduleRows.length) {
    return {
      available: false,
      reason: "NOT_SCHEDULED",
      detail: { message: "No scheduled shift found for this hostess on the required date" },
    };
  }

  // 3. Check if requiredUntil exceeds shift end
  const schedule = scheduleRows[0];
  if (!schedule.is_overnight) {
    const shiftEndStr = schedule.shift_end; // e.g. "23:00:00"
    const dateStr = requiredFrom.toISOString().slice(0, 10);
    const shiftEnd = new Date(`${dateStr}T${shiftEndStr}Z`);
    if (requiredUntil > shiftEnd) {
      return {
        available: false,
        reason: "SHIFT_END_CONFLICT",
        detail: { shiftEnd: shiftEnd.toISOString(), requiredUntil: requiredUntil.toISOString() },
      };
    }
  }

  // 4. Check hostess_session_assignments — ACTIVE overlap (excluding specified IDs)
  const excludeClause = excludeAssignmentIds.length > 0
    ? `AND id NOT IN (${excludeAssignmentIds.map((_, i) => `$${i + 4}`).join(",")})`
    : "";
  const { rows: overlapRows } = await pool.query<{ id: string }>(
    `SELECT id FROM hostess_session_assignments
     WHERE hostess_id = $1
       AND status = 'ACTIVE'
       AND session_start < $2
       AND (session_end > $3 OR session_end IS NULL)
       ${excludeClause}`,
    [hostessProfileId, requiredUntil.toISOString(), requiredFrom.toISOString(), ...excludeAssignmentIds]
  );

  if (overlapRows.length > 0) {
    return {
      available: false,
      reason: "ALREADY_ASSIGNED",
      detail: { conflictingAssignmentId: overlapRows[0].id },
    };
  }

  // 5. Check hostess_sessions (legacy) for active overlap
  const { rows: legacyOverlap } = await pool.query<{ id: string }>(
    `SELECT id FROM hostess_sessions
     WHERE hostess_id = $1
       AND status = 'active'
       AND start_at < $2
       AND (end_at > $3 OR end_at IS NULL)`,
    [profile.staff_id, requiredUntil.toISOString(), requiredFrom.toISOString()]
  );

  if (legacyOverlap.length > 0) {
    return {
      available: false,
      reason: "ALREADY_ASSIGNED",
      detail: { conflictingSessionId: legacyOverlap[0].id },
    };
  }

  // 6. Agency restriction check (if hostess belongs to an agency)
  if (profile.agency_id) {
    const { rows: agencyRows } = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM agents WHERE id = $1`,
      [profile.agency_id]
    );
    if (agencyRows.length && !agencyRows[0].is_active) {
      return {
        available: false,
        reason: "AGENCY_RESTRICTION",
        detail: { agencyId: profile.agency_id, message: "Agency is not active" },
      };
    }
  }

  return { available: true };
}
