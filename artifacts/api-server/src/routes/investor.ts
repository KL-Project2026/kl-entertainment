import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
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
        // Try to find a shareholder linked to this user's email
        const { rows } = await pool.query(
          "SELECT id FROM shareholders WHERE email = $1 AND is_active = true LIMIT 1",
          [req.user!.email]
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
          "SELECT id FROM shareholders WHERE email = $1 AND is_active = true LIMIT 1",
          [req.user!.email]
        );
        if (!rows.length) { res.status(403).json({ error: "NO_SHAREHOLDER_PROFILE" }); return; }
        shareholderId = rows[0].id;
      }

      const { rows } = await pool.query(
        `SELECT b.id, b.name, b.internal_code, b.city,
                bs.equity_pct, bs.effective_from
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
          "SELECT id FROM shareholders WHERE email = $1 AND is_active = true LIMIT 1",
          [req.user!.email]
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

export default router;
