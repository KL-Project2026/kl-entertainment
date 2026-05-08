import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { investorOnly, requireRole } from "../middleware/rbac";
import { runNightlyJob } from "../jobs/investorReportJob";
import { getInvestorDashboardSnapshot } from "../services/pnl-service";
import { getRevenueReport } from "../services/reports-service";

const router: IRouter = Router();

// All investor routes require authentication (shareholder or admin can view)

router.get(
  "/investor/dashboard",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Resolve shareholder ID: if query param provided (admin viewing), use that; else look up by user
      let shareholderId = req.query["shareholder_id"] as string;
      if (!shareholderId) {
        // Look up shareholder by matching staff email (req.user.id → staff.email → shareholders.email)
        const { rows } = await pool.query(
          `SELECT sh.id FROM shareholders sh
           JOIN staff st ON st.email = sh.email
           WHERE st.id = $1 AND sh.is_active = true LIMIT 1`,
          [req.user!.id]
        );
        if (!rows.length) {
          res.status(403).json({ error: "No shareholder profile for this account" });
          return;
        }
        shareholderId = rows[0].id;
      }

      const snapshot = await getInvestorDashboardSnapshot(shareholderId);
      res.json({ data: snapshot });
    } catch (err) {
      console.error("Investor dashboard error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/investor/branches",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      let shareholderId = req.query["shareholder_id"] as string;
      if (!shareholderId) {
        const { rows } = await pool.query(
          `SELECT sh.id FROM shareholders sh
           JOIN staff st ON st.email = sh.email
           WHERE st.id = $1 AND sh.is_active = true LIMIT 1`,
          [req.user!.id]
        );
        if (!rows.length) { res.status(403).json({ error: "NO_SHAREHOLDER_PROFILE" }); return; }
        shareholderId = rows[0].id;
      }

      const { rows } = await pool.query(
        `SELECT b.id, b.name, b.internal_code, b.city,
                bs.equity_pct, bs.agreed_rate, bs.investment_amount, bs.effective_from
         FROM branches b
         JOIN branch_shareholders bs ON bs.branch_id = b.id
         WHERE bs.shareholder_id = $1
           AND (bs.effective_to IS NULL OR bs.effective_to >= CURRENT_DATE)
           AND b.deleted_at IS NULL
         ORDER BY b.name`,
        [shareholderId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("Investor branches error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/investor/revenue",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.query["branch_id"] as string;
      const from = (req.query["from"] as string) ?? new Date().toISOString().split("T")[0].slice(0, 7) + "-01";
      const to = (req.query["to"] as string) ?? new Date().toISOString().split("T")[0];

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const data = await getRevenueReport(branchId, from, to);
      res.json({ data });
    } catch (err) {
      console.error("Investor revenue error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/investor/profit-loss",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.query["branch_id"] as string;
      const month = (req.query["month"] as string) ?? new Date().toISOString().slice(0, 7);

      if (!branchId) { res.status(400).json({ error: "branch_id required" }); return; }

      const { calculateBranchPnL } = await import("../services/pnl-service");
      const monthStart = `${month}-01`;
      const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1, 0))
        .toISOString()
        .split("T")[0];

      const data = await calculateBranchPnL(branchId, monthStart, monthEnd);
      res.json({ data });
    } catch (err) {
      console.error("Investor P&L error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/investor/settlements",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      let shareholderId = req.query["shareholder_id"] as string;
      if (!shareholderId) {
        const { rows } = await pool.query(
          `SELECT sh.id FROM shareholders sh
           JOIN staff st ON st.email = sh.email
           WHERE st.id = $1 AND sh.is_active = true LIMIT 1`,
          [req.user!.id]
        );
        if (!rows.length) { res.status(403).json({ error: "NO_SHAREHOLDER_PROFILE" }); return; }
        shareholderId = rows[0].id;
      }

      const { rows } = await pool.query(
        `SELECT ps.*, b.name AS branch_name, b.internal_code
         FROM profit_settlements ps
         JOIN branches b ON b.id = ps.branch_id
         WHERE ps.shareholder_id = $1
         ORDER BY ps.period_start DESC`,
        [shareholderId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("Investor settlements error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/investor/settlements/:id/pdf",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT ps.*, b.name AS branch_name, b.internal_code,
                s.name AS shareholder_name, s.preferred_currency,
                s.bank_name, s.bank_account, s.swift_code
         FROM profit_settlements ps
         JOIN branches b ON b.id = ps.branch_id
         JOIN shareholders s ON s.id = ps.shareholder_id
         WHERE ps.id = $1`,
        [req.params["id"]]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      const s = rows[0];
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Settlement — ${s.shareholder_name}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background:#0D0D14; color:#E8E0C8; padding: 40px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 28px; color: #C9A84C; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 32px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; color: #C9A84C; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .row .label { color: #888; }
    .row .value { font-weight: 600; }
    .total { border-top: 2px solid #C9A84C; margin-top: 8px; padding-top: 12px; }
    .total .value { color: #C9A84C; font-size: 20px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: rgba(201,168,76,0.15); color: #C9A84C; border: 1px solid rgba(201,168,76,0.3); }
    @media print { body { background: white; color: black; } h1, .total .value { color: #8B6914; } }
  </style>
</head>
<body>
  <h1>KL Entertainment Group</h1>
  <div class="subtitle">Shareholder Profit Settlement Statement</div>

  <div class="section">
    <h2>Settlement Details</h2>
    <div class="row"><span class="label">Shareholder</span><span class="value">${s.shareholder_name}</span></div>
    <div class="row"><span class="label">Branch</span><span class="value">${s.branch_name} (${s.internal_code})</span></div>
    <div class="row"><span class="label">Period</span><span class="value">${s.period_start} to ${s.period_end}</span></div>
    <div class="row"><span class="label">Equity Stake</span><span class="value">${(parseFloat(s.equity_pct_snapshot) * 100).toFixed(1)}%</span></div>
    <div class="row"><span class="label">Status</span><span class="value"><span class="badge">${s.status}</span></span></div>
  </div>

  <div class="section">
    <h2>Financial Summary</h2>
    <div class="row"><span class="label">Gross Revenue</span><span class="value">MYR ${parseFloat(s.gross_revenue).toFixed(2)}</span></div>
    <div class="row"><span class="label">Total Expenses</span><span class="value">MYR ${parseFloat(s.total_expenses).toFixed(2)}</span></div>
    <div class="row"><span class="label">Net Profit</span><span class="value">MYR ${parseFloat(s.net_profit).toFixed(2)}</span></div>
    <div class="row total">
      <span class="label">Your Settlement (${(parseFloat(s.equity_pct_snapshot) * 100).toFixed(1)}%)</span>
      <span class="value">MYR ${parseFloat(s.settlement_amount_myr).toFixed(2)}</span>
    </div>
    ${parseFloat(s.fx_rate) !== 1.0 ? `
    <div class="row" style="margin-top:8px">
      <span class="label">FX Rate (MYR → ${s.payout_currency})</span>
      <span class="value">${parseFloat(s.fx_rate).toFixed(4)}</span>
    </div>
    <div class="row">
      <span class="label">Payout Amount (${s.payout_currency})</span>
      <span class="value">${s.payout_currency} ${parseFloat(s.settlement_amount_fx).toFixed(2)}</span>
    </div>` : ""}
  </div>

  ${s.bank_name ? `
  <div class="section">
    <h2>Banking Details</h2>
    <div class="row"><span class="label">Bank</span><span class="value">${s.bank_name}</span></div>
    <div class="row"><span class="label">Account</span><span class="value">${s.bank_account}</span></div>
    ${s.swift_code ? `<div class="row"><span class="label">SWIFT</span><span class="value">${s.swift_code}</span></div>` : ""}
  </div>` : ""}

  <div style="margin-top: 40px; font-size: 11px; color: #666; text-align: center;">
    Generated: ${new Date().toLocaleString("en-MY")} · KL Entertainment Group · Confidential
  </div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="settlement-${s.id.slice(0,8)}.html"`);
      res.send(html);
    } catch (err) {
      console.error("Settlement PDF error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── NEW: /investor/reports — uses investor_reports aggregate table ─────────
// Returns pre-aggregated monthly reports (investor_reports table only)
// NEVER queries live transactional tables for this endpoint
router.get(
  "/investor/reports",
  authenticate,
  investorOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const role = user.role;
      const orgId = "00000000-0000-0000-0000-000000000001"; // KL Entertainment Group

      const period = req.query["period"] as string | undefined;
      const branchId = req.query["branch_id"] as string | undefined;

      const whereParts: string[] = ["ir.org_id = $1"];
      const params: unknown[] = [orgId];
      let pIdx = 2;

      if (period) {
        whereParts.push(`ir.period = $${pIdx++}`);
        params.push(period);
      }

      // Investor role: filter by investor_branch_scope
      if (role === "investor") {
        const scope = user.investorBranchScope ?? [];
        if (scope.length > 0) {
          whereParts.push(`ir.branch_id = ANY($${pIdx++})`);
          params.push(scope);
        }
      } else if (branchId) {
        whereParts.push(`ir.branch_id = $${pIdx++}`);
        params.push(branchId);
      }

      const where = whereParts.join(" AND ");
      const { rows } = await pool.query(
        `SELECT
          ir.id,
          ir.period,
          ir.branch_name,
          ir.report_type,
          ir.total_revenue,
          ir.room_revenue,
          ir.beverage_revenue,
          ir.food_revenue,
          ir.package_revenue,
          ir.other_revenue,
          ir.total_commission_expense,
          ir.gross_profit,
          ir.net_profit,
          ir.room_utilization_pct,
          ir.total_sessions,
          ir.unique_customers,
          ir.avg_spend_per_session,
          ir.notes,
          ir.currency_code,
          ir.generated_at,
          b.name AS branch_display_name
         FROM investor_reports ir
         LEFT JOIN branches b ON b.id = ir.branch_id
         WHERE ${where}
         ORDER BY ir.period DESC, ir.branch_name ASC`,
        params
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[Investor] GET /reports error:", err);
      res.status(500).json({ error: "Failed to fetch investor reports" });
    }
  }
);

// ── NEW: /investor/reports/export/:period — log and return data ────────────
router.get(
  "/investor/reports/export/:period",
  authenticate,
  investorOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { period } = req.params as { period: string };
      const staffId = req.user!.id;
      const orgId = "00000000-0000-0000-0000-000000000001";
      const watermarkText = `CONFIDENTIAL — ${req.user!.id} — ${new Date().toISOString()}`;

      const { rows } = await pool.query(
        `SELECT ir.*, b.name AS branch_display_name
         FROM investor_reports ir
         LEFT JOIN branches b ON b.id = ir.branch_id
         WHERE ir.org_id = $1 AND ir.period = $2
         ORDER BY ir.branch_name ASC`,
        [orgId, period]
      );

      // Log the export
      await pool.query(
        `INSERT INTO investor_export_logs
          (staff_id, report_period, ip_address, file_format, watermark_text)
         VALUES ($1, $2, $3, 'JSON', $4)`,
        [staffId, period, req.ip ?? "unknown", watermarkText]
      );

      res.json({ data: rows, period, watermark: watermarkText });
    } catch (err) {
      console.error("[Investor] Export error:", err);
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// ── NEW: /investor/kpis — aggregated KPI metrics from investor_reports ─────
router.get(
  "/investor/kpis",
  authenticate,
  investorOnly,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const role = user.role;
      const orgId = "00000000-0000-0000-0000-000000000001";

      const whereParts: string[] = ["org_id = $1"];
      const params: unknown[] = [orgId];
      let pIdx = 2;

      if (role === "investor") {
        const scope = user.investorBranchScope ?? [];
        if (scope.length > 0) {
          whereParts.push(`branch_id = ANY($${pIdx++})`);
          params.push(scope);
        }
      }

      const where = whereParts.join(" AND ");
      const { rows } = await pool.query(
        `SELECT
          period,
          SUM(total_revenue)          AS total_revenue,
          SUM(gross_profit)           AS gross_profit,
          SUM(net_profit)             AS net_profit,
          AVG(room_utilization_pct)   AS avg_utilization,
          SUM(total_sessions)         AS total_sessions,
          SUM(unique_customers)       AS unique_customers,
          AVG(avg_spend_per_session)  AS avg_spend
         FROM investor_reports
         WHERE ${where}
         GROUP BY period
         ORDER BY period DESC
         LIMIT 12`,
        params
      );

      res.json({ data: rows });
    } catch (err) {
      console.error("[Investor] GET /kpis error:", err);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  }
);

// ── NEW: /investor/reports (POST) — admin creates/upserts monthly report ───
router.post(
  "/investor/reports",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role = req.user!.role;
      if (!["super_admin", "admin", "branch_manager"].includes(role)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
      }

      const {
        branch_id, branch_name, period, report_type,
        total_revenue, room_revenue, beverage_revenue, food_revenue,
        package_revenue, other_revenue, total_operating_cost,
        total_commission_expense, gross_profit, net_profit,
        room_utilization_pct, total_sessions, unique_customers,
        avg_spend_per_session, notes, currency_code,
      } = req.body as Record<string, unknown>;

      const orgId = "00000000-0000-0000-0000-000000000001";

      const { rows } = await pool.query(
        `INSERT INTO investor_reports (
          org_id, branch_id, branch_name, period, report_type,
          total_revenue, room_revenue, beverage_revenue, food_revenue,
          package_revenue, other_revenue, total_operating_cost,
          total_commission_expense, gross_profit, net_profit,
          room_utilization_pct, total_sessions, unique_customers,
          avg_spend_per_session, notes, generated_by, currency_code
         ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18,
          $19, $20, $21, $22
         )
         ON CONFLICT (org_id, branch_id, period)
         DO UPDATE SET
          branch_name            = EXCLUDED.branch_name,
          report_type            = EXCLUDED.report_type,
          total_revenue          = EXCLUDED.total_revenue,
          room_revenue           = EXCLUDED.room_revenue,
          beverage_revenue       = EXCLUDED.beverage_revenue,
          food_revenue           = EXCLUDED.food_revenue,
          package_revenue        = EXCLUDED.package_revenue,
          other_revenue          = EXCLUDED.other_revenue,
          total_operating_cost   = EXCLUDED.total_operating_cost,
          total_commission_expense = EXCLUDED.total_commission_expense,
          gross_profit           = EXCLUDED.gross_profit,
          net_profit             = EXCLUDED.net_profit,
          room_utilization_pct   = EXCLUDED.room_utilization_pct,
          total_sessions         = EXCLUDED.total_sessions,
          unique_customers       = EXCLUDED.unique_customers,
          avg_spend_per_session  = EXCLUDED.avg_spend_per_session,
          notes                  = EXCLUDED.notes,
          generated_by           = EXCLUDED.generated_by,
          currency_code          = EXCLUDED.currency_code,
          generated_at           = NOW()
         RETURNING *`,
        [
          orgId, branch_id ?? null, branch_name ?? null, period, report_type ?? "MONTHLY",
          total_revenue ?? 0, room_revenue ?? 0, beverage_revenue ?? 0, food_revenue ?? 0,
          package_revenue ?? 0, other_revenue ?? 0, total_operating_cost ?? 0,
          total_commission_expense ?? 0, gross_profit ?? 0, net_profit ?? 0,
          room_utilization_pct ?? 0, total_sessions ?? 0, unique_customers ?? 0,
          avg_spend_per_session ?? 0, notes ?? null, req.user!.id, currency_code ?? "MYR",
        ]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("[Investor] POST /reports error:", err);
      res.status(500).json({ error: "Failed to create report" });
    }
  }
);

// ── POST /api/admin/reports/regenerate ────────────────────────────────────
// Manually trigger the nightly investor report aggregation job (admin only)
router.post(
  "/admin/reports/regenerate",
  authenticate,
  requireRole("super_admin", "admin"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await runNightlyJob();
      res.json({ message: "Investor report regeneration triggered successfully." });
    } catch (err) {
      console.error("[Admin] reports/regenerate error:", err);
      res.status(500).json({ error: "Report generation failed", detail: (err as Error).message });
    }
  }
);

export default router;
