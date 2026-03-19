import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { buildAgentStatement } from "../services/commission-service";

const router: IRouter = Router();

function formatAgent(row: Record<string, unknown>) {
  return {
    id: row.id,
    orgId: row.org_id,
    agentType: row.agent_type ?? "agency",
    name: row.name,
    contactPerson: row.contact_person ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    commissionType: row.commission_type ?? "pct",
    commissionRate: parseFloat(row.commission_rate as string) || 0,
    commissionBase: row.commission_base ?? "hostess_gross",
    paymentCycle: row.payment_cycle ?? "monthly",
    paymentMethod: row.payment_method ?? null,
    bankName: row.bank_name ?? null,
    bankAccount: row.bank_account ?? null,
    preferredCurrency: row.preferred_currency ?? "MYR",
    creditBalance: parseFloat(row.credit_balance as string) || 0,
    notes: row.notes ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    hostessCount: row.hostess_count ? parseInt(row.hostess_count as string) : 0,
  };
}

// List agents
router.get(
  "/agents",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { org_id, active } = req.query as Record<string, string>;
      const conditions: string[] = ["a.deleted_at IS NULL"];
      const params: unknown[] = [];
      let p = 1;

      if (org_id) { conditions.push(`a.org_id = $${p++}`); params.push(org_id); }
      if (active !== undefined) { conditions.push(`a.is_active = $${p++}`); params.push(active === "true"); }

      const { rows } = await pool.query(
        `SELECT a.*,
                COUNT(s.id) AS hostess_count
         FROM agents a
         LEFT JOIN staff s ON s.agent_id = a.id AND s.deleted_at IS NULL
         WHERE ${conditions.join(" AND ")}
         GROUP BY a.id
         ORDER BY a.name`,
        params
      );

      res.json({ data: (rows as Record<string, unknown>[]).map(formatAgent) });
    } catch (err) {
      console.error("List agents error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create agent
router.post(
  "/agents",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.name || !body.orgId) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO agents (org_id, agent_type, name, contact_person, phone, whatsapp, email,
           commission_type, commission_rate, commission_base, payment_cycle, payment_method,
           bank_name, bank_account, preferred_currency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          body.orgId, body.agentType ?? "agency", body.name,
          body.contactPerson ?? null, body.phone ?? null, body.whatsapp ?? null, body.email ?? null,
          body.commissionType ?? "pct",
          body.commissionRate ?? 0,
          body.commissionBase ?? "hostess_gross",
          body.paymentCycle ?? "monthly", body.paymentMethod ?? null,
          body.bankName ?? null, body.bankAccount ?? null,
          body.preferredCurrency ?? "MYR", body.notes ?? null,
        ]
      );

      res.status(201).json({ data: formatAgent(rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("Create agent error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Get single agent
router.get(
  "/agents/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT a.*, COUNT(s.id) AS hostess_count
         FROM agents a
         LEFT JOIN staff s ON s.agent_id = a.id AND s.deleted_at IS NULL
         WHERE a.id = $1 AND a.deleted_at IS NULL
         GROUP BY a.id`,
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: formatAgent(rows[0] as Record<string, unknown>) });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Update agent
router.put(
  "/agents/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE agents SET
           name = COALESCE($1, name),
           contact_person = COALESCE($2, contact_person),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           commission_type = COALESCE($5, commission_type),
           commission_rate = COALESCE($6, commission_rate),
           payment_method = COALESCE($7, payment_method),
           bank_name = COALESCE($8, bank_name),
           bank_account = COALESCE($9, bank_account),
           preferred_currency = COALESCE($10, preferred_currency),
           notes = COALESCE($11, notes),
           is_active = COALESCE($12, is_active)
         WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
        [
          body.name ?? null, body.contactPerson ?? null, body.phone ?? null,
          body.email ?? null, body.commissionType ?? null, body.commissionRate ?? null,
          body.paymentMethod ?? null, body.bankName ?? null, body.bankAccount ?? null,
          body.preferredCurrency ?? null, body.notes ?? null, body.isActive ?? null,
          req.params.id,
        ]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ data: formatAgent(rows[0] as Record<string, unknown>) });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Agent commission statement
router.get(
  "/agents/:id/statement",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const today = new Date().toISOString().split("T")[0];
      const firstOfMonth = today.slice(0, 7) + "-01";
      const statement = await buildAgentStatement(
        req.params.id,
        from ?? firstOfMonth,
        to ?? today
      );
      res.json({ data: statement });
    } catch (err) {
      if ((err as Error).message === "AGENT_NOT_FOUND") {
        res.status(404).json({ error: "NOT_FOUND" });
      } else {
        console.error("Agent statement error:", err);
        res.status(500).json({ error: "INTERNAL_ERROR" });
      }
    }
  }
);

// List hostesses under agent
router.get(
  "/agents/:id/hostesses",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT s.id, s.full_name, s.phone, s.employment_type, s.is_active, b.internal_code AS branch_code
         FROM staff s
         JOIN branches b ON b.id = s.branch_id
         WHERE s.agent_id = $1 AND s.deleted_at IS NULL
         ORDER BY s.full_name`,
        [req.params.id]
      );
      res.json({
        data: (rows as Record<string, unknown>[]).map((r) => ({
          id: r.id,
          fullName: r.full_name,
          phone: r.phone ?? null,
          employmentType: r.employment_type,
          isActive: r.is_active,
          branchCode: r.branch_code,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Record payout to agent (resets/reduces credit_balance)
router.post(
  "/agents/:id/payout",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.amountMyr || !body.periodFrom || !body.periodTo) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }

      // Get current agent balance
      const { rows: agentRows } = await pool.query(
        "SELECT credit_balance, preferred_currency FROM agents WHERE id = $1",
        [req.params.id]
      );
      if (!agentRows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const agent = agentRows[0] as Record<string, unknown>;
      const balanceBefore = parseFloat(agent.credit_balance as string) || 0;
      const amountMyr = parseFloat(body.amountMyr as string);
      const fxRate = parseFloat((body.fxRate as string) ?? "1") || 1;
      const amountFx = Math.round(amountMyr * fxRate * 100) / 100;

      // Insert payout record
      const { rows } = await pool.query(
        `INSERT INTO agent_payouts (agent_id, period_from, period_to, amount_myr, payout_currency,
           fx_rate, amount_fx, payment_method, payment_ref, balance_before, notes, paid_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          req.params.id, body.periodFrom, body.periodTo,
          amountMyr,
          body.payoutCurrency ?? agent.preferred_currency ?? "MYR",
          fxRate, amountFx,
          body.paymentMethod ?? null, body.paymentRef ?? null,
          balanceBefore, body.notes ?? null, req.user!.id,
        ]
      );

      // Deduct from agent credit balance
      await pool.query(
        "UPDATE agents SET credit_balance = credit_balance - $1 WHERE id = $2",
        [amountMyr, req.params.id]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("Agent payout error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// List agent payouts
router.get(
  "/agents/:id/payouts",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT ap.*, s.full_name AS paid_by_name
         FROM agent_payouts ap
         LEFT JOIN staff s ON s.id = ap.paid_by
         WHERE ap.agent_id = $1
         ORDER BY ap.paid_at DESC`,
        [req.params.id]
      );
      res.json({
        data: (rows as Record<string, unknown>[]).map((r) => ({
          id: r.id,
          agentId: r.agent_id,
          periodFrom: r.period_from,
          periodTo: r.period_to,
          amountMyr: parseFloat(r.amount_myr as string),
          payoutCurrency: r.payout_currency,
          fxRate: parseFloat(r.fx_rate as string),
          amountFx: parseFloat(r.amount_fx as string),
          paymentMethod: r.payment_method ?? null,
          paymentRef: r.payment_ref ?? null,
          balanceBefore: parseFloat(r.balance_before as string),
          notes: r.notes ?? null,
          paidByName: r.paid_by_name ?? null,
          paidAt: r.paid_at,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
