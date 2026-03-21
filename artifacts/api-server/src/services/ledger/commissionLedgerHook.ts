// MIGRATION: .NET — DomainEvent handler in SessionSlice
import { pool } from "@workspace/db";
import { postCommission } from "./ledgerService";

interface AssignmentLedgerData {
  assignmentId: string;
  hostessProfileId: string;
  agentId: string | null;
  agentFeeRate: number;
  grossCommission: number;
}

/**
 * Resolve orgId from branchId via branches table.
 */
async function resolveOrgId(branchId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ org_id: string }>(
      `SELECT org_id FROM branches WHERE id = $1 LIMIT 1`,
      [branchId]
    );
    return rows[0]?.org_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch ledger-relevant data for all COMPLETED assignments of a reservation.
 * ✅ hostess_id → hostess_profiles.id, agency_id → agents.id
 */
async function fetchAssignmentLedgerData(reservationId: string): Promise<AssignmentLedgerData[]> {
  const { rows } = await pool.query<{
    id: string;
    hostess_id: string;
    agency_id: string | null;
    agency_rate_pct: string | null;
    gross_commission: string | null;
  }>(`
    SELECT id, hostess_id, agency_id, agency_rate_pct, gross_commission
    FROM hostess_session_assignments
    WHERE reservation_id   = $1
      AND status           = 'COMPLETED'
      AND commission_status IN ('CALCULATED','APPROVED')
      AND gross_commission  > 0
  `, [reservationId]);

  return rows.map(r => ({
    assignmentId:     r.id,
    hostessProfileId: r.hostess_id,
    agentId:          r.agency_id ?? null,
    agentFeeRate:     r.agency_rate_pct ? parseFloat(r.agency_rate_pct) / 100 : 0,
    grossCommission:  r.gross_commission ? parseFloat(r.gross_commission) : 0,
  }));
}

/**
 * Called after session close — posts commission ledger entries for all hostesses.
 * NON-BLOCKING: failures are logged, never thrown.
 *
 * @param reservationId - reservations.id
 * @param branchId      - branches.id (from reservation)
 * @param postedBy      - staff.id (req.user.id)
 * @param ipAddress     - optional, for audit
 */
export async function onSessionClose(
  reservationId: string,
  branchId: string,
  postedBy: string,
  ipAddress?: string | null,
): Promise<void> {
  try {
    const orgId = await resolveOrgId(branchId);
    if (!orgId) {
      console.error(`[LEDGER HOOK] Cannot resolve orgId for branch: ${branchId}`);
      return;
    }

    const assignments = await fetchAssignmentLedgerData(reservationId);
    if (!assignments.length) {
      console.log(`[LEDGER HOOK] No billable assignments for reservation: ${reservationId}`);
      return;
    }

    let ok = 0;
    let fail = 0;

    for (const a of assignments) {
      if (a.grossCommission <= 0) continue;

      const result = await postCommission({
        orgId,
        branchId,
        hostessProfileId: a.hostessProfileId,
        reservationId,
        entryType:        "commission_session",
        grossAmount:      a.grossCommission,
        agentId:          a.agentId,
        agentFeeRate:     a.agentFeeRate,
        currency:         "MYR",
        postedBy,
        ipAddress:        ipAddress ?? null,
      });

      if (result.success) {
        ok++;
      } else {
        fail++;
        console.warn(`[LEDGER HOOK] Assignment ${a.assignmentId} commission failed: ${result.error}`);
      }
    }

    console.log(`[LEDGER HOOK] reservation ${reservationId}: ${ok} ok, ${fail} failed`);
  } catch (err) {
    console.error("[LEDGER HOOK] onSessionClose error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Called when a tip is recorded for a hostess.
 */
export async function onTipRecorded(
  branchId: string,
  hostessProfileId: string,
  reservationId: string,
  tipAmount: number,
  postedBy: string,
  ipAddress?: string | null,
): Promise<void> {
  if (!tipAmount || tipAmount <= 0) return;
  try {
    const orgId = await resolveOrgId(branchId);
    if (!orgId) return;

    const { rows } = await pool.query<{ id: string }>(`
      SELECT id FROM ledger_accounts
      WHERE account_type = 'hostess'
        AND entity_id    = $1
        AND org_id       = $2
      LIMIT 1
    `, [hostessProfileId, orgId]);

    if (!rows.length) return;

    const { postEntry } = await import("./ledgerService");
    await postEntry({
      orgId, branchId,
      accountId:   rows[0].id,
      entryType:   "tip",
      direction:   "CR",
      amount:      tipAmount,
      currency:    "MYR",
      sourceType:  "reservation",
      sourceId:    reservationId,
      description: `Tip — reservation ${reservationId}`,
      postedBy,
      ipAddress:   ipAddress ?? null,
    });
  } catch (err) {
    console.error("[LEDGER HOOK] onTipRecorded error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Called when a driver pickup is completed.
 * ✅ reservation_pickups integration
 */
export async function onPickupCompleted(
  branchId: string,
  driverStaffId: string,
  pickupId: string,
  feeAmount: number,
  postedBy: string,
  ipAddress?: string | null,
): Promise<void> {
  if (!feeAmount || feeAmount <= 0) return;
  try {
    const orgId = await resolveOrgId(branchId);
    if (!orgId) return;

    const { rows } = await pool.query<{ id: string }>(`
      SELECT id FROM ledger_accounts
      WHERE account_type = 'driver'
        AND entity_id    = $1
        AND org_id       = $2
      LIMIT 1
    `, [driverStaffId, orgId]);

    if (!rows.length) return;

    const { postEntry } = await import("./ledgerService");
    await postEntry({
      orgId, branchId,
      accountId:   rows[0].id,
      entryType:   "pickup_fee",
      direction:   "CR",
      amount:      feeAmount,
      currency:    "MYR",
      sourceType:  "reservation_pickup",
      sourceId:    pickupId,
      description: `Pickup fee — ${pickupId}`,
      postedBy,
      ipAddress:   ipAddress ?? null,
    });
  } catch (err) {
    console.error("[LEDGER HOOK] onPickupCompleted error:", err instanceof Error ? err.message : err);
  }
}
