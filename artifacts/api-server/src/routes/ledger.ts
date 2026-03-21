import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { postEntry, getBalance, reverseEntry } from "../services/ledger/ledgerService";
import { generatePayslip, generateBranchPayslips, issuePayslip } from "../services/ledger/payslipService";
import {
  createPayoutResolution,
  createAgentPaymentResolution,
  approveResolution,
  rejectResolution,
} from "../services/ledger/resolutionService";

const router: IRouter = Router();

// ─── Helper: resolve org_id for a staff member via their branch ──────────────
async function resolveOrgId(staffId: string): Promise<string | null> {
  const { rows } = await pool.query<{ org_id: string }>(
    `SELECT b.org_id FROM staff s JOIN branches b ON b.id = s.branch_id WHERE s.id = $1 LIMIT 1`,
    [staffId]
  );
  return rows[0]?.org_id ?? null;
}

// ─── Ledger Accounts ─────────────────────────────────────────────────────────

router.get(
  "/ledger/accounts",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const { account_type, branch_id } = req.query as Record<string, string | undefined>;
      const params: unknown[]  = [orgId];
      let q = `
        SELECT la.*,
               COALESCE(v.current_balance, 0) AS live_balance,
               v.last_transaction_at
        FROM ledger_accounts la
        LEFT JOIN v_account_balances v ON v.account_id = la.id
        WHERE la.org_id = $1 AND la.is_active = TRUE
      `;
      if (account_type) { params.push(account_type); q += ` AND la.account_type=$${params.length}`; }
      if (branch_id)    { params.push(branch_id);    q += ` AND la.branch_id=$${params.length}`; }
      q += " ORDER BY la.account_type, la.created_at";

      const { rows } = await pool.query(q, params);
      res.json({ success: true, accounts: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get(
  "/ledger/accounts/:accountType/:entityId/balance",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountType, entityId } = req.params;
      const user = req.user!;
      const isSelf  = user.id === entityId;
      const isAdmin = ["admin", "super_admin", "branch_manager"].includes(user.role);
      if (!isSelf && !isAdmin) { res.status(403).json({ success: false, error: "Forbidden" }); return; }
      if (user.role === "investor") { res.status(403).json({ success: false, error: "Investors access v_investor_summary only" }); return; }

      const orgId = await resolveOrgId(user.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const result = await getBalance({ orgId, accountType, entityId });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get(
  "/ledger/accounts/:accountType/:entityId/entries",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountType, entityId } = req.params;
      const { from, to, status, limit = "50", offset = "0" } = req.query as Record<string, string | undefined>;
      const user = req.user!;

      const isSelf  = user.id === entityId;
      const isAdmin = ["admin", "super_admin", "branch_manager"].includes(user.role);
      if (!isSelf && !isAdmin) { res.status(403).json({ success: false, error: "Forbidden" }); return; }
      if (user.role === "investor") { res.status(403).json({ success: false, error: "Forbidden: use investor summary endpoint" }); return; }

      const orgId = await resolveOrgId(user.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const { rows: acctRows } = await pool.query(
        `SELECT id FROM ledger_accounts WHERE org_id=$1 AND account_type=$2 AND entity_id=$3 LIMIT 1`,
        [orgId, accountType, entityId]
      );
      if (!acctRows.length) { res.status(404).json({ success: false, error: "Account not found" }); return; }

      const params: unknown[] = [acctRows[0].id];
      let q = "SELECT * FROM ledger_entries WHERE account_id=$1";
      if (from)   { params.push(from);   q += ` AND effective_date>=$${params.length}`; }
      if (to)     { params.push(to);     q += ` AND effective_date<=$${params.length}`; }
      if (status) { params.push(status); q += ` AND status=$${params.length}`; }

      const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM (${q}) t`, params);
      params.push(parseInt(limit));
      params.push(parseInt(offset ?? "0"));
      q += ` ORDER BY effective_date DESC, posted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const { rows: entries } = await pool.query(q, params);
      res.json({ success: true, total: parseInt(countRows[0].count), entries });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ─── Payslips ────────────────────────────────────────────────────────────────

router.post(
  "/ledger/payslips/generate",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { account_id, entity_type, entity_id, period_start, period_end, branch_id } = req.body as Record<string, string>;
      if (!account_id || !period_start || !period_end) {
        res.status(400).json({ success: false, error: "account_id, period_start, period_end required" }); return;
      }
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const result = await generatePayslip({
        orgId, branchId: branch_id ?? null,
        accountId: account_id, entityType: entity_type, entityId: entity_id,
        periodStart: period_start, periodEnd: period_end, createdBy: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.post(
  "/ledger/payslips/generate-batch",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, account_type, period_start, period_end } = req.body as Record<string, string>;
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const result = await generateBranchPayslips({
        orgId, branchId: branch_id, accountType: account_type ?? "hostess",
        periodStart: period_start, periodEnd: period_end, createdBy: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get(
  "/ledger/payslips",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { entity_type, entity_id, status, period_start, period_end } = req.query as Record<string, string | undefined>;
      const user = req.user!;
      const isSelf  = user.id === entity_id;
      const isAdmin = ["admin", "super_admin", "branch_manager"].includes(user.role);
      if (!isSelf && !isAdmin) { res.status(403).json({ success: false, error: "Forbidden" }); return; }

      const orgId = await resolveOrgId(user.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const params: unknown[] = [orgId];
      let q = "SELECT * FROM payslips WHERE org_id=$1";
      if (entity_type)  { params.push(entity_type);  q += ` AND entity_type=$${params.length}`; }
      if (entity_id)    { params.push(entity_id);    q += ` AND entity_id=$${params.length}`; }
      if (status)       { params.push(status);       q += ` AND status=$${params.length}`; }
      if (period_start) { params.push(period_start); q += ` AND period_start>=$${params.length}`; }
      if (period_end)   { params.push(period_end);   q += ` AND period_end<=$${params.length}`; }
      q += " ORDER BY period_start DESC";

      const { rows } = await pool.query(q, params);
      res.json({ success: true, payslips: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.patch(
  "/ledger/payslips/:id/issue",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await issuePayslip(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.patch(
  "/ledger/payslips/:id/acknowledge",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows: psRows } = await pool.query(
        "SELECT * FROM payslips WHERE id=$1", [req.params.id]
      );
      if (!psRows.length) { res.status(404).json({ success: false, error: "Not found" }); return; }

      const { rows: acctRows } = await pool.query(
        "SELECT entity_id FROM ledger_accounts WHERE id=$1", [psRows[0].account_id]
      );
      const entityId = acctRows[0]?.entity_id;
      const user = req.user!;
      // Allow if entity_id matches staff.id (for direct staff/driver) or hostess_profile entity
      const isOwner = entityId === user.id;
      const isAdmin = ["admin", "super_admin", "branch_manager"].includes(user.role);
      if (!isOwner && !isAdmin) { res.status(403).json({ success: false, error: "Forbidden" }); return; }

      await pool.query(
        `UPDATE payslips SET status='acknowledged', acknowledged_at=NOW(), acknowledged_by=$1, updated_at=NOW() WHERE id=$2 AND status='issued'`,
        [user.id, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ─── Resolutions ─────────────────────────────────────────────────────────────

router.post(
  "/ledger/resolutions/payout",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { payslip_ids, period_start, period_end, branch_id } = req.body as {
        payslip_ids: string[]; period_start: string; period_end: string; branch_id?: string;
      };
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const result = await createPayoutResolution({
        orgId, branchId: branch_id ?? null,
        payslipIds: payslip_ids, periodStart: period_start, periodEnd: period_end,
        requestedBy: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.post(
  "/ledger/resolutions/agent-payment",
  authenticate,
  requireRole(["admin", "super_admin"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { agent_id, accounting_period, branch_id } = req.body as Record<string, string>;
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const result = await createAgentPaymentResolution({
        orgId, branchId: branch_id ?? null,
        agentId: agent_id, accountingPeriod: accounting_period,
        requestedBy: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get(
  "/ledger/resolutions",
  authenticate,
  requireRole(["admin", "super_admin", "branch_manager"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { resolution_type, status, branch_id } = req.query as Record<string, string | undefined>;
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const params: unknown[] = [orgId];
      let q = "SELECT * FROM financial_resolutions WHERE org_id=$1";
      if (resolution_type) { params.push(resolution_type); q += ` AND resolution_type=$${params.length}`; }
      if (status)          { params.push(status);          q += ` AND status=$${params.length}`; }
      if (branch_id)       { params.push(branch_id);       q += ` AND branch_id=$${params.length}`; }
      q += " ORDER BY requested_at DESC";

      const { rows } = await pool.query(q, params);
      res.json({ success: true, resolutions: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.patch(
  "/ledger/resolutions/:id/approve",
  authenticate,
  requireRole(["admin", "super_admin"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await approveResolution(req.params.id, req.user!.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.patch(
  "/ledger/resolutions/:id/reject",
  authenticate,
  requireRole(["admin", "super_admin"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      if (!reason || reason.trim().length < 5) {
        res.status(400).json({ success: false, error: "reason required (min 5 chars)" }); return;
      }
      const result = await rejectResolution({ resolutionId: req.params.id, rejectedBy: req.user!.id, reason });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ─── Manual Entries ───────────────────────────────────────────────────────────

router.post(
  "/ledger/entries/manual-adjustment",
  authenticate,
  requireRole(["admin", "super_admin"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { account_id, direction, amount, currency, description, audit_note, effective_date } =
        req.body as Record<string, string>;

      if (!audit_note || audit_note.trim().length < 10) {
        res.status(400).json({ success: false, error: "audit_note required (min 10 chars)" }); return;
      }

      const { rows: acctRows } = await pool.query(
        "SELECT org_id FROM ledger_accounts WHERE id=$1", [account_id]
      );
      const orgId = await resolveOrgId(req.user!.id);
      if (!acctRows.length || acctRows[0].org_id !== orgId) {
        res.status(403).json({ success: false, error: "Forbidden" }); return;
      }

      const result = await postEntry({
        orgId: orgId!,
        accountId:     account_id,
        entryType:     "manual_adjustment",
        direction:     direction as "DR" | "CR",
        amount:        parseFloat(amount),
        currency:      currency ?? "MYR",
        sourceType:    "manual",
        effectiveDate: effective_date ?? null,
        description:   description ?? null,
        auditNote:     audit_note,
        postedBy:      req.user!.id,
        ipAddress:     req.ip ?? null,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.post(
  "/ledger/entries/:id/reverse",
  authenticate,
  requireRole(["admin", "super_admin"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      if (!reason || reason.trim().length < 5) {
        res.status(400).json({ success: false, error: "reason required (min 5 chars)" }); return;
      }
      const result = await reverseEntry({
        originalEntryId: req.params.id,
        reason,
        postedBy:  req.user!.id,
        ipAddress: req.ip ?? null,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ─── Investor ─────────────────────────────────────────────────────────────────

router.get(
  "/ledger/investor/summary",
  authenticate,
  requireRole(["admin", "super_admin", "investor"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { period, branch_id } = req.query as Record<string, string | undefined>;
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const params: unknown[] = [orgId];
      let q = "SELECT * FROM v_investor_summary WHERE org_id=$1";
      if (period)    { params.push(period);    q += ` AND accounting_period=$${params.length}`; }
      if (branch_id) { params.push(branch_id); q += ` AND branch_id=$${params.length}`; }
      q += " ORDER BY accounting_period DESC";

      const { rows } = await pool.query(q, params);
      res.json({ success: true, summary: rows, note: "Aggregated data only — no PII" });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get(
  "/ledger/investor/unpaid-liabilities",
  authenticate,
  requireRole(["admin", "super_admin", "investor"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = await resolveOrgId(req.user!.id);
      if (!orgId) { res.status(403).json({ success: false, error: "Cannot resolve org" }); return; }

      const { rows } = await pool.query(
        `SELECT account_type, branch_id, currency,
                COUNT(*) AS account_count, SUM(unpaid_balance) AS total_unpaid
         FROM v_unpaid_balances
         WHERE org_id=$1
         GROUP BY account_type, branch_id, currency
         ORDER BY total_unpaid DESC`,
        [orgId]
      );
      res.json({ success: true, liabilities: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
