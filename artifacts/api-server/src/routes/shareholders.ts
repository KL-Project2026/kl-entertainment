import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

import { calculateShareholderSettlement } from "../services/pnl-service";

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const router: IRouter = Router();

// ── Shareholders CRUD ──────────────────────────────────────────────────────

const BRANCH_EQUITIES_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object(
      'branchId',        b.id,
      'branchName',      b.name,
      'equityPct',       bs.equity_pct,
      'agreedRate',      bs.agreed_rate,
      'investmentAmount', bs.investment_amount,
      'effectiveFrom',   bs.effective_from,
      'effectiveTo',     bs.effective_to
    ) ORDER BY b.name)
    FROM branch_shareholders bs
    JOIN branches b ON b.id = bs.branch_id
    WHERE bs.shareholder_id = s.id
      AND (bs.effective_to IS NULL OR bs.effective_to >= CURRENT_DATE)
    ),
    '[]'::json
  )
`;

router.get(
  "/shareholders",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = (req.query["org_id"] as string) ?? (req.user as { orgId?: string }).orgId;
      const { rows } = await pool.query(
        `SELECT s.*,
           ${BRANCH_EQUITIES_SUBQUERY} AS branch_equities
         FROM shareholders s
         WHERE s.org_id = $1 AND s.is_active = true
         ORDER BY s.name`,
        [orgId ?? "00000000-0000-0000-0000-000000000001"]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("List shareholders error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/shareholders/:id",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*,
           ${BRANCH_EQUITIES_SUBQUERY} AS branch_equities
         FROM shareholders s
         WHERE s.id = $1`,
        [req.params["id"]]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("Get shareholder error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.post(
  "/shareholders",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO shareholders (org_id, name, email, phone, nationality, bank_name, bank_account, bank_country, swift_code, preferred_currency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          body.orgId ?? "00000000-0000-0000-0000-000000000001",
          body.name, body.email, body.phone, body.nationality,
          body.bankName, body.bankAccount, body.bankCountry, body.swiftCode,
          body.preferredCurrency ?? "MYR", body.notes,
        ]
      );
      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("Create shareholder error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.put(
  "/shareholders/:id",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE shareholders SET
           name = COALESCE($2, name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           nationality = COALESCE($5, nationality),
           bank_name = COALESCE($6, bank_name),
           bank_account = COALESCE($7, bank_account),
           preferred_currency = COALESCE($8, preferred_currency),
           notes = COALESCE($9, notes)
         WHERE id = $1 RETURNING *`,
        [
          req.params["id"], body.name, body.email, body.phone,
          body.nationality, body.bankName, body.bankAccount,
          body.preferredCurrency, body.notes,
        ]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("Update shareholder error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── Branch Equity ──────────────────────────────────────────────────────────

router.post(
  "/shareholders/:id/equity",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO branch_shareholders (branch_id, shareholder_id, equity_pct, agreed_rate, investment_amount, effective_from, effective_to, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT ON CONSTRAINT branch_shareholders_branch_id_shareholder_id_effective_from_key DO UPDATE SET
           equity_pct        = EXCLUDED.equity_pct,
           agreed_rate       = EXCLUDED.agreed_rate,
           investment_amount = EXCLUDED.investment_amount,
           effective_to      = EXCLUDED.effective_to
         RETURNING *`,
        [
          body.branchId, req.params["id"],
          body.equityPct,
          body.agreedRate ?? body.equityPct,
          body.investmentAmount ?? 0,
          body.effectiveFrom, body.effectiveTo ?? null, body.notes,
        ]
      );
      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("Set equity error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── Settlement Generation ──────────────────────────────────────────────────

router.post(
  "/shareholders/:id/settlements",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { branchId, periodStart, periodEnd } = body as { branchId: string; periodStart: string; periodEnd: string };

      if (!branchId || !periodStart || !periodEnd) {
        res.status(400).json({ error: "branchId, periodStart, periodEnd required" });
        return;
      }

      const calc = await calculateShareholderSettlement(
        branchId, req.params["id"], periodStart, periodEnd
      );

      // Save to DB
      const { rows } = await pool.query(
        `INSERT INTO profit_settlements
           (branch_id, shareholder_id, period_start, period_end,
            gross_revenue, total_expenses, net_profit, equity_pct_snapshot,
            settlement_amount_myr, payout_currency, fx_rate, settlement_amount_fx,
            status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13)
         RETURNING *`,
        [
          calc.branchId, calc.shareholderId,
          calc.periodStart, calc.periodEnd,
          calc.grossRevenue, calc.totalExpenses, calc.netProfit,
          calc.equityPctSnapshot, calc.settlementAmountMyr,
          calc.payoutCurrency, calc.fxRate, calc.settlementAmountFx,
          req.user!.id,
        ]
      );

      res.status(201).json({ data: { ...rows[0], revenueBreakdown: calc.revenueBreakdown, expenseBreakdown: calc.expenseBreakdown } });
    } catch (err) {
      console.error("Generate settlement error:", err);
      if ((err as Error).message === "SHAREHOLDER_NOT_FOUND_FOR_BRANCH") {
        res.status(400).json({ error: "No active equity found for this shareholder in the selected branch" });
        return;
      }
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.get(
  "/shareholders/:id/settlements",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT ps.*, b.name AS branch_name
         FROM profit_settlements ps
         JOIN branches b ON b.id = ps.branch_id
         WHERE ps.shareholder_id = $1
         ORDER BY ps.period_start DESC`,
        [req.params["id"]]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("List settlements error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.put(
  "/shareholders/:id/settlements/:settlementId/approve",
  authenticate,
  requireRole(...ADMIN_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE profit_settlements SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2 AND shareholder_id = $3 RETURNING *`,
        [req.user!.id, req.params["settlementId"], req.params["id"]]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("Approve settlement error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
