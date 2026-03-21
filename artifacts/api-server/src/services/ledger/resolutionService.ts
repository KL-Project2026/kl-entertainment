// MIGRATION: .NET — ResolutionService
import { pool } from "@workspace/db";

export interface PayoutResolutionParams {
  orgId: string;
  branchId?: string | null;
  payslipIds: string[];
  periodStart: string;
  periodEnd: string;
  requestedBy: string;
}

export interface AgentPaymentResolutionParams {
  orgId: string;
  branchId?: string | null;
  agentId: string;
  accountingPeriod: string; // "YYYY-MM"
  requestedBy: string;
}

export async function createPayoutResolution(params: PayoutResolutionParams): Promise<{
  success: boolean;
  resolutionId?: string;
  totalAmount?: number;
  payslipCount?: number;
  error?: string;
}> {
  const { orgId, branchId = null, payslipIds, periodStart, periodEnd, requestedBy } = params;

  try {
    const { rows: payslips } = await pool.query<{
      id: string; account_id: string; entity_name: string | null;
      entity_type: string; net_payable: string;
    }>(`
      SELECT ps.id, ps.account_id, ps.entity_name, ps.entity_type,
             ps.net_payable
      FROM payslips ps
      JOIN ledger_accounts la ON la.id = ps.account_id
      WHERE ps.id = ANY($1)
        AND ps.org_id = $2
        AND ps.status IN ('issued','acknowledged')
    `, [payslipIds, orgId]);

    if (!payslips.length) {
      return { success: false, error: "No eligible payslips" };
    }

    const totalAmount = parseFloat(
      payslips.reduce((s, p) => s + parseFloat(p.net_payable), 0).toFixed(2)
    );

    const affectedAccounts = payslips.map(p => ({
      account_id:  p.account_id,
      entity_name: p.entity_name,
      entity_type: p.entity_type,
      amount:      parseFloat(p.net_payable),
      payslip_id:  p.id,
    }));

    const { rows: insertRows } = await pool.query<{ id: string }>(`
      INSERT INTO financial_resolutions (
        org_id, branch_id,
        resolution_type, title,
        period_start, period_end,
        total_amount, currency,
        affected_accounts,
        status, requested_by,
        requested_at, created_at, updated_at
      ) VALUES (
        $1,$2,
        'payout_approval', $3,
        $4,$5,
        $6,'MYR',
        $7,
        'pending',$8,
        NOW(),NOW(),NOW()
      ) RETURNING id
    `, [
      orgId, branchId,
      `급여 지급 결의서 — ${periodStart} ~ ${periodEnd}`,
      periodStart, periodEnd,
      totalAmount,
      affectedAccounts,
      requestedBy,
    ]);

    return {
      success: true,
      resolutionId: insertRows[0].id,
      totalAmount,
      payslipCount: payslips.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[RESOLUTION] createPayout failed:", msg);
    return { success: false, error: msg };
  }
}

export async function createAgentPaymentResolution(params: AgentPaymentResolutionParams): Promise<{
  success: boolean;
  resolutionId?: string;
  agentName?: string;
  totalAmount?: number;
  entryCount?: number;
  message?: string;
  error?: string;
}> {
  const { orgId, branchId = null, agentId, accountingPeriod, requestedBy } = params;

  try {
    const { rows: accruals } = await pool.query<{ id: string; amount: string; effective_date: string }>(
      `SELECT le.id, le.amount, le.effective_date
       FROM ledger_entries le
       JOIN ledger_accounts la ON la.id = le.account_id
       WHERE la.account_type      = 'agent'
         AND la.entity_id         = $1
         AND le.org_id            = $2
         AND le.entry_type        = 'fee_accrued'
         AND le.accounting_period = $3
         AND le.status            = 'posted'
         AND le.document_id IS NULL`,
      [agentId, orgId, accountingPeriod]
    );

    if (!accruals.length) {
      return { success: false, message: "No unbilled agent accruals" };
    }

    const totalAmount = parseFloat(
      accruals.reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(2)
    );
    const entryIds = accruals.map(r => r.id);

    // agents.name ✅
    const { rows: agentRows } = await pool.query<{ name: string }>(
      "SELECT name FROM agents WHERE id = $1", [agentId]
    );
    const agentName = agentRows[0]?.name ?? agentId;

    const [y, m]     = accountingPeriod.split("-");
    const periodStart = `${y}-${m}-01`;
    const periodEnd   = new Date(parseInt(y), parseInt(m), 0).toISOString().split("T")[0];

    const { rows: insertRows } = await pool.query<{ id: string }>(`
      INSERT INTO financial_resolutions (
        org_id, branch_id,
        resolution_type, title,
        period_start, period_end,
        total_amount, currency,
        affected_accounts, ledger_entry_ids,
        status, requested_by,
        requested_at, created_at, updated_at
      ) VALUES (
        $1,$2,
        'agent_payment', $3,
        $4,$5,
        $6,'MYR',
        $7,$8,
        'pending',$9,
        NOW(),NOW(),NOW()
      ) RETURNING id
    `, [
      orgId, branchId,
      `Agent 수수료 결의서 — ${agentName} — ${accountingPeriod}`,
      periodStart, periodEnd,
      totalAmount,
      JSON.stringify([{
        account_type: "agent",
        entity_name:  agentName,
        agent_id:     agentId,
        amount:       totalAmount,
      }]),
      entryIds,
      requestedBy,
    ]);

    // Link entries → resolution
    await pool.query(
      `UPDATE ledger_entries SET document_type='resolution', document_id=$1 WHERE id = ANY($2)`,
      [insertRows[0].id, entryIds]
    );

    return {
      success: true,
      resolutionId: insertRows[0].id,
      agentName,
      totalAmount,
      entryCount: accruals.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[RESOLUTION] createAgentPayment failed:", msg);
    return { success: false, error: msg };
  }
}

export async function approveResolution(resolutionId: string, approvedBy: string): Promise<{
  success: boolean; resolution?: unknown; error?: string;
}> {
  const { rows } = await pool.query(`
    UPDATE financial_resolutions
    SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
    WHERE id=$2 AND status='pending'
    RETURNING *
  `, [approvedBy, resolutionId]);

  return rows.length
    ? { success: true, resolution: rows[0] }
    : { success: false, error: "Not found or not pending" };
}

export async function rejectResolution(params: {
  resolutionId: string; rejectedBy: string; reason: string;
}): Promise<{ success: boolean; resolution?: unknown; error?: string }> {
  const { resolutionId, rejectedBy, reason } = params;

  const { rows } = await pool.query(`
    UPDATE financial_resolutions
    SET status='rejected', rejected_by=$1, rejection_reason=$2, updated_at=NOW()
    WHERE id=$3 AND status='pending'
    RETURNING *
  `, [rejectedBy, reason, resolutionId]);

  if (!rows.length) {
    return { success: false, error: "Not found or not pending" };
  }

  // Unlink entries so they can be reused
  const entryIds = (rows[0] as { ledger_entry_ids?: string[] }).ledger_entry_ids;
  if (entryIds?.length) {
    await pool.query(
      `UPDATE ledger_entries SET document_type=NULL, document_id=NULL WHERE id = ANY($1)`,
      [entryIds]
    );
  }

  return { success: true, resolution: rows[0] };
}
