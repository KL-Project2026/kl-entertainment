// MIGRATION: .NET — HostessAvailabilityHub (SignalR)
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { checkHostessAvailability } from "../services/hostessAvailabilityService";
import {
  calculateCommission,
  calculateCommissionForReservation,
} from "../services/hostessCommissionService";
import { onSessionClose as ledgerOnSessionClose } from "../services/ledger/commissionLedgerHook";
import type { Server as SocketServer } from "socket.io";

const router: IRouter = Router();

// Role guards
const managerAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER
);

// ── Shared IO ref ──────────────────────────────────────────────────────────
let _io: SocketServer | null = null;
export function initHostessAssignmentsSocket(io: SocketServer): void {
  _io = io;
}

// ── Error helper ───────────────────────────────────────────────────────────
function errResp(res: Response, status: number, code: string, message: string, detail: Record<string, unknown> = {}) {
  res.status(status).json({ success: false, error: { code, message, detail } });
}

// ── Rate snapshot helper ───────────────────────────────────────────────────
async function getRateSnapshot(hostessProfileId: string): Promise<{
  hourlyRateGuest: number;
  commissionRatePct: number;
  agencyRatePct: number | null;
  agencyId: string | null;
}> {
  // Try active contract first
  const { rows: contractRows } = await pool.query<{
    venue_commission_rate: string;
    agent_commission_rate: string;
    agent_id: string;
  }>(
    `SELECT ahc.venue_commission_rate, ahc.agent_commission_rate, hp.agency_id AS agent_id
     FROM agent_hostess_contracts ahc
     JOIN hostess_profiles hp ON hp.id = $1
     WHERE ahc.hostess_profile_id = $1
       AND ahc.is_active = true
       AND ahc.contract_start <= CURRENT_DATE
       AND (ahc.contract_end IS NULL OR ahc.contract_end >= CURRENT_DATE)
     LIMIT 1`,
    [hostessProfileId]
  );

  // Fallback: use branch default from hostess_profiles
  const { rows: profileRows } = await pool.query<{
    agency_id: string | null;
  }>(
    `SELECT agency_id FROM hostess_profiles WHERE id = $1`,
    [hostessProfileId]
  );
  const agencyId = profileRows[0]?.agency_id ?? null;

  if (contractRows.length) {
    const c = contractRows[0];
    return {
      hourlyRateGuest:    parseFloat(c.venue_commission_rate) || 80,
      commissionRatePct:  parseFloat(c.venue_commission_rate),
      agencyRatePct:      parseFloat(c.agent_commission_rate),
      agencyId,
    };
  }

  return { hourlyRateGuest: 80, commissionRatePct: 60, agencyRatePct: null, agencyId };
}

// ── createHostessAssignmentFromPOS ─────────────────────────────────────────
export async function createHostessAssignmentFromPOS(params: {
  reservationId: string;
  posOrderId:    string;
  hostessId:     string;
  orderType:     "INITIAL" | "ADD_ON" | "EXTENSION" | "REPLACEMENT";
  notes?:        string;
  assignedBy?:   string;
  branchId:      string;
  sessionStart?: Date;
  parentAssignmentId?: string;
  excludeAssignmentIds?: string[];
}): Promise<{ assignmentId: string; folioEntryId: string }> {
  const {
    reservationId, posOrderId, hostessId, orderType,
    notes, assignedBy, branchId, parentAssignmentId,
    excludeAssignmentIds = [],
  } = params;
  const sessionStart = params.sessionStart ?? new Date();

  // 1. Fetch reservation scheduled_end for availability window
  const { rows: resRows } = await pool.query<{ end_time: Date; room_id: string | null }>(
    `SELECT end_time, room_id FROM reservations WHERE id = $1`,
    [reservationId]
  );
  const requiredUntil = resRows[0]?.end_time ? new Date(resRows[0].end_time) : new Date(sessionStart.getTime() + 2 * 3600 * 1000);

  // 2. Availability check
  const avail = await checkHostessAvailability(hostessId, sessionStart, requiredUntil, branchId, excludeAssignmentIds);
  if (!avail.available) {
    throw Object.assign(new Error(avail.reason), {
      code: "HOSTESS_NOT_AVAILABLE",
      reason: avail.reason,
      detail: (avail as { available: false; reason: string; detail: Record<string, unknown> }).detail,
    });
  }

  // 3. Rate snapshot
  const rates = await getRateSnapshot(hostessId);

  // 4. Fetch hostess display name for folio description
  const { rows: nameRows } = await pool.query<{ name: string }>(
    `SELECT s.full_name AS name FROM hostess_profiles hp JOIN staff s ON s.id = hp.staff_id WHERE hp.id = $1`,
    [hostessId]
  );
  const hostessName = nameRows[0]?.name ?? "Hostess";

  // Format local time (MYR timezone)
  const localStart = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(sessionStart);

  // 5. INSERT assignment
  const { rows: asmRows } = await pool.query<{ id: string }>(
    `INSERT INTO hostess_session_assignments
       (reservation_id, hostess_id, agency_id, pos_order_id,
        session_start, order_type, parent_assignment_id,
        hourly_rate_guest, commission_rate_pct, agency_rate_pct,
        assigned_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      reservationId, hostessId, rates.agencyId, posOrderId,
      sessionStart.toISOString(), orderType, parentAssignmentId ?? null,
      rates.hourlyRateGuest, rates.commissionRatePct, rates.agencyRatePct,
      assignedBy ?? null, notes ?? null,
    ]
  );
  const assignmentId = asmRows[0].id;

  // 6. INSERT folio_entry (quantity=0 — updated at session close)
  const description = `Hostess ${hostessName} — ${orderType} from ${localStart}`;
  const { rows: feRows } = await pool.query<{ id: string }>(
    `INSERT INTO folio_entries
       (reservation_id, order_id, entry_type, description, quantity, unit_price, amount,
        hostess_session_id, posted_by, notes)
     VALUES ($1,$2,'HOSTESS',$3,0,$4,0,$5,$6,$7)
     RETURNING id`,
    [
      reservationId, posOrderId, description,
      rates.hourlyRateGuest, assignmentId,
      assignedBy ?? null, notes ?? null,
    ]
  );
  const folioEntryId = feRows[0].id;

  // 7. Audit log
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, new_values)
     VALUES ('hostess_session_assignments', $1, 'created', $2, $3)`,
    [assignmentId, assignedBy ?? null,
      JSON.stringify({ reservationId, hostessId, orderType, posOrderId })]
  );

  // 8. Socket.io emit
  if (_io && resRows[0]) {
    _io.to(`branch:${branchId}`).emit("hostess:assigned", {
      roomId:       resRows[0].room_id,
      hostessId,
      hostessName,
      orderType,
      assignmentId,
      sessionStart: sessionStart.toISOString(),
    });
  }

  return { assignmentId, folioEntryId };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/hostess-assignments/add-on
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/hostess-assignments/add-on",
  authenticate,
  managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reservationId, hostessId, notes } = req.body as Record<string, string>;

      if (!reservationId || !hostessId) {
        errResp(res, 400, "VALIDATION_ERROR", "reservationId and hostessId are required");
        return;
      }

      // 1. Validate reservation is OCCUPIED (checked_in or extended)
      const { rows: resRows } = await pool.query<{
        status: string; branch_id: string; end_time: Date | null;
      }>(
        `SELECT status, branch_id, end_time FROM reservations WHERE id = $1`,
        [reservationId]
      );
      if (!resRows.length) { errResp(res, 404, "ASSIGNMENT_NOT_FOUND", "Reservation not found"); return; }
      const reservation = resRows[0];
      if (!["checked_in", "extended"].includes(reservation.status)) {
        errResp(res, 400, "RESERVATION_NOT_OCCUPIED",
          "Reservation must be checked_in or extended to add hostess"); return;
      }

      // 2. Create a POS order (HOSTESS order type)
      const { rows: orderRows } = await pool.query<{ id: string; order_no: string }>(
        `INSERT INTO orders (id, order_no, reservation_id, branch_id, order_type,
           subtotal, discount_amount, sst_amount, service_charge, total_amount,
           payment_status, created_by)
         VALUES (gen_random_uuid(),
           concat('HOS-', to_char(now(),'YYMMDD'), '-', floor(random()*9000+1000)::text),
           $1, $2, 'hostess', 0, 0, 0, 0, 0, 'pending', $3)
         RETURNING id, order_no`,
        [reservationId, reservation.branch_id, req.user!.id]
      );
      const posOrderId = orderRows[0].id;

      // 3. Create assignment (triggers availability check + folio entry)
      const { assignmentId } = await createHostessAssignmentFromPOS({
        reservationId,
        posOrderId,
        hostessId,
        orderType: "ADD_ON",
        notes,
        assignedBy:   req.user!.id,
        branchId:     reservation.branch_id,
        sessionStart: new Date(),
      });

      // Fetch created assignment
      const { rows: asmRows } = await pool.query(
        `SELECT hsa.*, hp.agency_id, s.full_name AS hostess_name
         FROM hostess_session_assignments hsa
         JOIN hostess_profiles hp ON hp.id = hsa.hostess_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE hsa.id = $1`,
        [assignmentId]
      );

      res.status(201).json({ success: true, data: asmRows[0] });
    } catch (err) {
      const e = err as Error & { code?: string; detail?: unknown };
      if (e.code === "HOSTESS_NOT_AVAILABLE") {
        errResp(res, 400, e.code, e.message, { detail: e.detail });
        return;
      }
      console.error("[hostess-assignments/add-on]", err);
      errResp(res, 500, "INTERNAL_ERROR", "Unexpected error");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/hostess-assignments/extend
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/hostess-assignments/extend",
  authenticate,
  managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reservationId, extensionMinutes, replaceHostessId } =
        req.body as Record<string, unknown>;

      if (!reservationId || !extensionMinutes) {
        errResp(res, 400, "VALIDATION_ERROR", "reservationId and extensionMinutes are required"); return;
      }

      const extMins = Number(extensionMinutes);

      // Fetch reservation
      const { rows: resRows } = await pool.query<{
        status: string; branch_id: string; end_time: Date | null; room_id: string | null;
      }>(
        `SELECT status, branch_id, end_time, room_id FROM reservations WHERE id = $1`,
        [reservationId as string]
      );
      if (!resRows.length) { errResp(res, 404, "ASSIGNMENT_NOT_FOUND", "Reservation not found"); return; }
      const reservation = resRows[0];

      const currentEnd = reservation.end_time ? new Date(reservation.end_time) : new Date();
      const newEnd = new Date(currentEnd.getTime() + extMins * 60000);

      // Fetch active assignments
      const { rows: activeAsm } = await pool.query<{
        id: string; hostess_id: string; session_start: Date;
      }>(
        `SELECT id, hostess_id, session_start FROM hostess_session_assignments
         WHERE reservation_id = $1 AND status = 'ACTIVE'`,
        [reservationId as string]
      );

      if (!replaceHostessId) {
        // ── EXTENSION (same hostesses) ──────────────────────────────────────
        const results = [];
        for (const asm of activeAsm) {
          const avail = await checkHostessAvailability(
            asm.hostess_id, currentEnd, newEnd, reservation.branch_id,
            [asm.id] // exclude the current assignment from overlap check
          );
          if (!avail.available) {
            errResp(res, 400, "SHIFT_END_CONFLICT",
              `Hostess ${asm.hostess_id} not available for extension`,
              (avail as { available: false; reason: string; detail: Record<string, unknown> }).detail);
            return;
          }

          // Create POS order for extension
          const { rows: orderRows } = await pool.query<{ id: string }>(
            `INSERT INTO orders (id, order_no, reservation_id, branch_id, order_type,
               subtotal, discount_amount, sst_amount, service_charge, total_amount,
               payment_status, created_by)
             VALUES (gen_random_uuid(),
               concat('HEX-', to_char(now(),'YYMMDD'), '-', floor(random()*9000+1000)::text),
               $1,$2,'hostess',0,0,0,0,0,'pending',$3)
             RETURNING id`,
            [reservationId as string, reservation.branch_id, req.user!.id]
          );

          const { assignmentId } = await createHostessAssignmentFromPOS({
            reservationId:        reservationId as string,
            posOrderId:           orderRows[0].id,
            hostessId:            asm.hostess_id,
            orderType:            "EXTENSION",
            assignedBy:           req.user!.id,
            branchId:             reservation.branch_id,
            sessionStart:         currentEnd,
            parentAssignmentId:   asm.id,
            excludeAssignmentIds: [asm.id],
          });

          results.push({ parentId: asm.id, newAssignmentId: assignmentId });
        }

        // Socket.io
        if (_io) {
          for (const r of results) {
            _io.to(`branch:${reservation.branch_id}`).emit("hostess:extended", {
              roomId:           reservation.room_id,
              assignmentId:     r.newAssignmentId,
              newEnd:           newEnd.toISOString(),
              extensionMinutes: extMins,
            });
          }
        }

        res.json({ success: true, data: { orderType: "EXTENSION", results } });
        return;
      }

      // ── REPLACEMENT ─────────────────────────────────────────────────────
      const replaceId = replaceHostessId as string;

      if (!activeAsm.length) {
        errResp(res, 404, "ASSIGNMENT_NOT_FOUND", "No active assignment to replace"); return;
      }

      const outgoing = activeAsm[0];
      const now = new Date();

      // Close outgoing assignment
      await pool.query(
        `UPDATE hostess_session_assignments
         SET session_end = $1, status = 'COMPLETED', updated_at = NOW()
         WHERE id = $2`,
        [now.toISOString(), outgoing.id]
      );

      // Calculate commission for outgoing
      const outCommission = await calculateCommission(outgoing.id, req.user!.id);

      // Update folio entry quantity to billed_hours
      await pool.query(
        `UPDATE folio_entries
         SET quantity = $1, amount = $1 * unit_price
         WHERE hostess_session_id = $2`,
        [outCommission.billedHours, outgoing.id]
      );

      // Audit close
      await pool.query(
        `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, new_values)
         VALUES ('hostess_session_assignments', $1, 'closed_for_replacement', $2, $3)`,
        [outgoing.id, req.user!.id,
          JSON.stringify({ session_end: now, status: "COMPLETED", reason: "REPLACEMENT" })]
      );

      // Availability check for incoming
      const avail = await checkHostessAvailability(replaceId, now, newEnd, reservation.branch_id);
      if (!avail.available) {
        errResp(res, 400, "HOSTESS_NOT_AVAILABLE",
          "Replacement hostess not available",
          (avail as { available: false; reason: string; detail: Record<string, unknown> }).detail);
        return;
      }

      // Create order for replacement
      const { rows: repOrderRows } = await pool.query<{ id: string }>(
        `INSERT INTO orders (id, order_no, reservation_id, branch_id, order_type,
           subtotal, discount_amount, sst_amount, service_charge, total_amount,
           payment_status, created_by)
         VALUES (gen_random_uuid(),
           concat('HRP-', to_char(now(),'YYMMDD'), '-', floor(random()*9000+1000)::text),
           $1,$2,'hostess',0,0,0,0,0,'pending',$3)
         RETURNING id`,
        [reservationId as string, reservation.branch_id, req.user!.id]
      );

      const { assignmentId: newAsmId } = await createHostessAssignmentFromPOS({
        reservationId:      reservationId as string,
        posOrderId:         repOrderRows[0].id,
        hostessId:          replaceId,
        orderType:          "REPLACEMENT",
        assignedBy:         req.user!.id,
        branchId:           reservation.branch_id,
        sessionStart:       now,
        parentAssignmentId: outgoing.id,
      });

      // Fetch names for socket event
      const { rows: outNameRows } = await pool.query<{ name: string }>(
        `SELECT s.full_name AS name FROM hostess_session_assignments hsa
         JOIN hostess_profiles hp ON hp.id = hsa.hostess_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE hsa.id = $1`,
        [outgoing.id]
      );
      const { rows: inNameRows } = await pool.query<{ name: string }>(
        `SELECT s.full_name AS name FROM hostess_profiles hp
         JOIN staff s ON s.id = hp.staff_id
         WHERE hp.id = $1`,
        [replaceId]
      );

      if (_io) {
        _io.to(`branch:${reservation.branch_id}`).emit("hostess:replaced", {
          roomId:   reservation.room_id,
          outgoing: {
            hostessId:   outgoing.hostess_id,
            hostessName: outNameRows[0]?.name,
            billedHours: outCommission.billedHours,
          },
          incoming: {
            hostessId:    replaceId,
            hostessName:  inNameRows[0]?.name,
            assignmentId: newAsmId,
          },
        });
      }

      res.json({
        success: true,
        data: {
          orderType:          "REPLACEMENT",
          closedAssignmentId: outgoing.id,
          newAssignmentId:    newAsmId,
          outgoingCommission: outCommission,
        },
      });
    } catch (err) {
      const e = err as Error & { code?: string; detail?: unknown };
      if (e.code === "HOSTESS_NOT_AVAILABLE" || e.code === "COMMISSION_ALREADY_CALCULATED") {
        errResp(res, 400, e.code, e.message, { detail: e.detail }); return;
      }
      console.error("[hostess-assignments/extend]", err);
      errResp(res, 500, "INTERNAL_ERROR", "Unexpected error");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/hostess-assignments/close-session
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/hostess-assignments/close-session",
  authenticate,
  managerAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reservationId } = req.body as { reservationId: string };

      if (!reservationId) { errResp(res, 400, "VALIDATION_ERROR", "reservationId is required"); return; }

      const { rows: resRows } = await pool.query<{ branch_id: string; room_id: string | null }>(
        `SELECT branch_id, room_id FROM reservations WHERE id = $1`, [reservationId]
      );
      if (!resRows.length) { errResp(res, 404, "ASSIGNMENT_NOT_FOUND", "Reservation not found"); return; }

      const { rows: activeAsm } = await pool.query<{ id: string }>(
        `SELECT id FROM hostess_session_assignments
         WHERE reservation_id = $1 AND status = 'ACTIVE'`,
        [reservationId]
      );

      const now = new Date();

      // Close all active assignments
      for (const asm of activeAsm) {
        await pool.query(
          `UPDATE hostess_session_assignments
           SET session_end = $1, status = 'COMPLETED', updated_at = NOW()
           WHERE id = $2`,
          [now.toISOString(), asm.id]
        );
      }

      // Calculate commissions
      const summary = await calculateCommissionForReservation(reservationId, req.user!.id);

      // Update folio entries quantity to billed_hours
      for (const asm of summary.assignments) {
        await pool.query(
          `UPDATE folio_entries
           SET quantity = $1, amount = $1 * unit_price
           WHERE hostess_session_id = $2`,
          [asm.billedHours, asm.assignmentId]
        );
      }

      // Socket.io
      if (_io) {
        _io.to(`branch:${resRows[0].branch_id}`).emit("hostess:session-closed", {
          roomId:             resRows[0].room_id,
          reservationId,
          assignmentCount:    summary.assignmentCount,
          totalBilledHours:   summary.assignments.reduce((s, a) => s + a.billedHours, 0),
          totalNetCommission: summary.totalNet,
        });
      }

      res.json({ success: true, data: summary });

      // === LEDGER HOOK START (non-blocking — existing logic unaffected) ===
      // MIGRATION: Replace with C# DomainEvent in SessionSlice
      ledgerOnSessionClose(
        reservationId,
        resRows[0].branch_id,
        req.user!.id,
        req.ip ?? null,
      ).catch((ledgerErr: unknown) => {
        console.error("[LEDGER HOOK] Non-blocking error:", ledgerErr instanceof Error ? ledgerErr.message : ledgerErr);
      });
      // === LEDGER HOOK END ===

    } catch (err) {
      console.error("[hostess-assignments/close-session]", err);
      errResp(res, 500, "INTERNAL_ERROR", "Unexpected error");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/hostess-assignments/reservation/:reservationId
// ═══════════════════════════════════════════════════════════════════════════
router.get(
  "/hostess-assignments/reservation/:reservationId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reservationId } = req.params;
      const role = req.user!.role;
      const isManagerPlus = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER].includes(role);

      let selectCols = `
        hsa.id, hsa.reservation_id, hsa.hostess_id, hsa.pos_order_id,
        hsa.order_type, hsa.status, hsa.commission_status,
        hsa.session_start, hsa.session_end, hsa.billed_hours,
        s.full_name AS hostess_name`;

      if (isManagerPlus) {
        selectCols += `,
          hsa.hourly_rate_guest, hsa.commission_rate_pct, hsa.agency_rate_pct,
          hsa.gross_commission, hsa.agency_commission, hsa.net_commission,
          hsa.notes, hsa.assigned_at, hsa.parent_assignment_id`;
      }

      const { rows } = await pool.query(
        `SELECT ${selectCols}
         FROM hostess_session_assignments hsa
         JOIN hostess_profiles hp ON hp.id = hsa.hostess_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE hsa.reservation_id = $1
         ORDER BY hsa.session_start`,
        [reservationId]
      );

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error("[hostess-assignments/reservation]", err);
      errResp(res, 500, "INTERNAL_ERROR", "Unexpected error");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/hostess-assignments/hostess/:hostessId
// ═══════════════════════════════════════════════════════════════════════════
router.get(
  "/hostess-assignments/hostess/:hostessId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { hostessId } = req.params;
      const role = req.user!.role;
      const isManagerPlus = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER].includes(role);

      // Hostess role: can only see own assignments
      if (role === ROLES.HOSTESS) {
        const { rows: selfRows } = await pool.query<{ id: string }>(
          `SELECT hp.id FROM hostess_profiles hp JOIN staff s ON s.id = hp.staff_id WHERE s.id = $1`,
          [req.user!.id]
        );
        if (!selfRows.length || selfRows[0].id !== hostessId) {
          errResp(res, 403, "FORBIDDEN", "You can only view your own assignments"); return;
        }
      }

      const page  = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const offset = (page - 1) * limit;

      const conditions: string[] = ["hsa.hostess_id = $1"];
      const params: unknown[] = [hostessId];

      if (req.query.status) {
        params.push(req.query.status);
        conditions.push(`hsa.status = $${params.length}`);
      }
      if (req.query.from) {
        params.push(req.query.from);
        conditions.push(`hsa.session_start >= $${params.length}`);
      }
      if (req.query.to) {
        params.push(req.query.to);
        conditions.push(`hsa.session_start <= $${params.length}`);
      }

      let selectCols = `hsa.id, hsa.reservation_id, hsa.order_type, hsa.status,
        hsa.session_start, hsa.session_end, hsa.billed_hours, s.full_name AS hostess_name`;
      if (isManagerPlus) {
        selectCols += `, hsa.hourly_rate_guest, hsa.commission_rate_pct,
          hsa.gross_commission, hsa.agency_commission, hsa.net_commission,
          hsa.commission_status, hsa.notes`;
      }

      const { rows } = await pool.query(
        `SELECT ${selectCols}
         FROM hostess_session_assignments hsa
         JOIN hostess_profiles hp ON hp.id = hsa.hostess_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY hsa.session_start DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM hostess_session_assignments hsa
         WHERE ${conditions.join(" AND ")}`,
        params
      );

      res.json({
        success: true,
        data: rows,
        pagination: { page, limit, total: parseInt((countRows[0] as { total: string }).total) },
      });
    } catch (err) {
      console.error("[hostess-assignments/hostess]", err);
      errResp(res, 500, "INTERNAL_ERROR", "Unexpected error");
    }
  }
);

export default router;
