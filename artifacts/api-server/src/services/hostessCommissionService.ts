// MIGRATION: .NET — ICommissionCalculationService
import { pool } from "@workspace/db";

export interface AssignmentCommission {
  assignmentId: string;
  billedHours: number;
  grossCommission: number;
  agencyCommission: number;
  netCommission: number;
}

export interface ReservationCommissionSummary {
  totalGross: number;
  totalAgency: number;
  totalNet: number;
  assignmentCount: number;
  assignments: AssignmentCommission[];
}

/**
 * 10-minute threshold rounding rule:
 *   - diffMinutes / 60 → wholeHours + remainingMins
 *   - remainingMins < 10  → round DOWN  (ignore partial)
 *   - remainingMins >= 10 → round UP    (count as next full hour)
 *   - minimum 1 hour
 * Override: if billedHoursOverride is supplied, use it directly (manual adjustment).
 */
export function computeBilledHours(
  sessionStart: Date,
  sessionEnd: Date,
  billedHoursOverride?: number
): number {
  if (billedHoursOverride !== undefined && billedHoursOverride > 0) return billedHoursOverride;
  const diffMs = sessionEnd.getTime() - sessionStart.getTime();
  const diffMins = diffMs / 60_000;
  const whole = Math.floor(diffMins / 60);
  const rem = diffMins % 60;
  return Math.max(1, rem < 10 ? whole : whole + 1);
}

/**
 * Calculate commission for a single COMPLETED assignment.
 * Rounding: 10-minute threshold rule (see computeBilledHours).
 */
export async function calculateCommission(
  assignmentId: string,
  changedBy?: string,
  billedHoursOverride?: number
): Promise<AssignmentCommission> {
  const { rows } = await pool.query<{
    id: string; status: string; session_start: Date; session_end: Date | null;
    hourly_rate_guest: string; commission_rate_pct: string; agency_rate_pct: string | null;
    commission_status: string;
  }>(
    `SELECT id, status, session_start, session_end,
            hourly_rate_guest, commission_rate_pct, agency_rate_pct, commission_status
     FROM hostess_session_assignments
     WHERE id = $1`,
    [assignmentId]
  );

  if (!rows.length) {
    throw Object.assign(new Error("Assignment not found"), { code: "ASSIGNMENT_NOT_FOUND" });
  }

  const a = rows[0];

  if (a.commission_status === "CALCULATED" || a.commission_status === "APPROVED" || a.commission_status === "PAID") {
    throw Object.assign(
      new Error("Commission already calculated"),
      { code: "COMMISSION_ALREADY_CALCULATED" }
    );
  }

  if (a.status !== "COMPLETED" || !a.session_end) {
    throw Object.assign(
      new Error("Assignment must be COMPLETED with a session_end before commission calculation"),
      { code: "ASSIGNMENT_NOT_FOUND" }
    );
  }

  const billedHours = computeBilledHours(
    new Date(a.session_start), new Date(a.session_end), billedHoursOverride
  );

  const hourlyRate = parseFloat(a.hourly_rate_guest);
  const commissionPct = parseFloat(a.commission_rate_pct);
  const agencyPct = a.agency_rate_pct ? parseFloat(a.agency_rate_pct) : 0;

  const grossCommission = Math.round(billedHours * hourlyRate * (commissionPct / 100) * 100) / 100;
  const agencyCommission = agencyPct > 0
    ? Math.round(grossCommission * (agencyPct / 100) * 100) / 100
    : 0;
  const netCommission = Math.round((grossCommission - agencyCommission) * 100) / 100;

  await pool.query(
    `UPDATE hostess_session_assignments
     SET billed_hours = $1, gross_commission = $2, agency_commission = $3,
         net_commission = $4, commission_status = 'CALCULATED', updated_at = NOW()
     WHERE id = $5`,
    [billedHours, grossCommission, agencyCommission, netCommission, assignmentId]
  );

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, new_values)
     VALUES ('hostess_session_assignments', $1, 'commission_calculated', $2, $3)`,
    [
      assignmentId,
      changedBy ?? null,
      JSON.stringify({ billed_hours: billedHours, gross_commission: grossCommission,
                       agency_commission: agencyCommission, net_commission: netCommission }),
    ]
  );

  return { assignmentId, billedHours, grossCommission, agencyCommission, netCommission };
}

/**
 * Calculate commission for all COMPLETED assignments on a reservation.
 * overrides: { [assignmentId]: billedHours } — manual adjustments from POS close-session modal.
 */
export async function calculateCommissionForReservation(
  reservationId: string,
  changedBy?: string,
  overrides: Record<string, number> = {}
): Promise<ReservationCommissionSummary> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM hostess_session_assignments
     WHERE reservation_id = $1 AND status = 'COMPLETED'
       AND commission_status = 'PENDING'`,
    [reservationId]
  );

  const assignments: AssignmentCommission[] = [];
  for (const row of rows) {
    try {
      const result = await calculateCommission(row.id, changedBy, overrides[row.id]);
      assignments.push(result);
    } catch {
      // Skip already-calculated ones
    }
  }

  const totalGross   = assignments.reduce((s, a) => s + a.grossCommission, 0);
  const totalAgency  = assignments.reduce((s, a) => s + a.agencyCommission, 0);
  const totalNet     = assignments.reduce((s, a) => s + a.netCommission, 0);

  return {
    totalGross:      Math.round(totalGross  * 100) / 100,
    totalAgency:     Math.round(totalAgency * 100) / 100,
    totalNet:        Math.round(totalNet    * 100) / 100,
    assignmentCount: assignments.length,
    assignments,
  };
}
