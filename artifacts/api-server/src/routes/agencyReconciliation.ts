import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

const adminOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN);

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/agency/reconciliation
// Query: ?agencyId=uuid&month=2026-03&branchId=uuid
// ═══════════════════════════════════════════════════════════════════════════
router.get(
  "/agency/reconciliation",
  authenticate,
  adminOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { agencyId, month, branchId } = req.query as Record<string, string>;

      if (!agencyId || !month) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agencyId and month (YYYY-MM) are required" },
        });
        return;
      }

      const [year, mon] = month.split("-").map(Number);
      if (!year || !mon) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "month must be in YYYY-MM format" },
        });
        return;
      }

      const periodStart = new Date(year, mon - 1, 1);
      const periodEnd   = new Date(year, mon, 1);

      // Fetch agency info
      const { rows: agencyRows } = await pool.query<{
        id: string; name: string; commission_rate: string; payment_cycle: string;
      }>(
        `SELECT id, name, commission_rate, payment_cycle FROM agents WHERE id = $1`,
        [agencyId]
      );
      if (!agencyRows.length) {
        res.status(404).json({ success: false, error: { code: "AGENCY_NOT_FOUND", message: "Agency not found" } });
        return;
      }

      // Build filter
      const conditions = [
        "hsa.agency_id = $1",
        "hsa.commission_status IN ('CALCULATED','APPROVED','PAID')",
        "hsa.session_start >= $2",
        "hsa.session_start <  $3",
      ];
      const params: unknown[] = [agencyId, periodStart.toISOString(), periodEnd.toISOString()];

      if (branchId) {
        params.push(branchId);
        conditions.push(`r.branch_id = $${params.length}`);
      }

      const { rows: asmRows } = await pool.query<{
        id: string; order_type: string; billed_hours: string | null;
        gross_commission: string | null; agency_commission: string | null;
        net_commission: string | null; commission_status: string;
        session_start: Date; session_end: Date | null;
        hostess_name: string;
      }>(
        `SELECT hsa.id, hsa.order_type, hsa.billed_hours,
                hsa.gross_commission, hsa.agency_commission, hsa.net_commission,
                hsa.commission_status, hsa.session_start, hsa.session_end,
                s.name AS hostess_name
         FROM hostess_session_assignments hsa
         JOIN reservations r ON r.id = hsa.reservation_id
         JOIN hostess_profiles hp ON hp.id = hsa.hostess_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY hsa.session_start`,
        params
      );

      // Aggregate
      const orderTypes = ["INITIAL", "ADD_ON", "EXTENSION", "REPLACEMENT"] as const;
      type OT = typeof orderTypes[number];
      const byOrderType: Record<OT, { count: number; billedHours: number; grossCommission: number; agencyFee: number; hostessNet: number }> = {
        INITIAL:     { count: 0, billedHours: 0, grossCommission: 0, agencyFee: 0, hostessNet: 0 },
        ADD_ON:      { count: 0, billedHours: 0, grossCommission: 0, agencyFee: 0, hostessNet: 0 },
        EXTENSION:   { count: 0, billedHours: 0, grossCommission: 0, agencyFee: 0, hostessNet: 0 },
        REPLACEMENT: { count: 0, billedHours: 0, grossCommission: 0, agencyFee: 0, hostessNet: 0 },
      };

      let totalAssignments = 0;
      let totalBilledHours = 0;
      let totalGrossCommission = 0;
      let totalAgencyFee = 0;
      let totalHostessNet = 0;

      for (const row of asmRows) {
        const ot = row.order_type as OT;
        const bh  = parseFloat(row.billed_hours    ?? "0");
        const gc  = parseFloat(row.gross_commission ?? "0");
        const ac  = parseFloat(row.agency_commission ?? "0");
        const nc  = parseFloat(row.net_commission   ?? "0");

        totalAssignments++;
        totalBilledHours    += bh;
        totalGrossCommission += gc;
        totalAgencyFee      += ac;
        totalHostessNet     += nc;

        if (byOrderType[ot]) {
          byOrderType[ot].count++;
          byOrderType[ot].billedHours    += bh;
          byOrderType[ot].grossCommission += gc;
          byOrderType[ot].agencyFee      += ac;
          byOrderType[ot].hostessNet     += nc;
        }
      }

      const round = (n: number) => Math.round(n * 100) / 100;

      res.json({
        success: true,
        data: {
          agency: agencyRows[0],
          period: { month, start: periodStart.toISOString(), end: periodEnd.toISOString() },
          summary: {
            totalAssignments,
            totalBilledHours:    round(totalBilledHours),
            totalGrossCommission: round(totalGrossCommission),
            totalAgencyFee:      round(totalAgencyFee),
            totalHostessNet:     round(totalHostessNet),
          },
          byOrderType: Object.fromEntries(
            Object.entries(byOrderType).map(([k, v]) => [k, {
              ...v,
              billedHours:     round(v.billedHours),
              grossCommission: round(v.grossCommission),
              agencyFee:       round(v.agencyFee),
              hostessNet:      round(v.hostessNet),
            }])
          ),
          assignments: asmRows,
        },
      });
    } catch (err) {
      console.error("[agency/reconciliation]", err);
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
    }
  }
);

export default router;
