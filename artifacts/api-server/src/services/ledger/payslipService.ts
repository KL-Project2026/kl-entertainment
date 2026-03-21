// MIGRATION: .NET — PayslipService (PayrollSlice)
import { pool } from "@workspace/db";

const EARNING_TYPES = [
  "commission_session", "commission_drink", "commission_package",
  "tip", "bonus", "pickup_fee", "allowance", "base_salary",
];
const DEDUCTION_TYPES = [
  "advance", "advance_repayment", "agent_deduction",
  "penalty", "deduction",
];

export interface GeneratePayslipParams {
  orgId: string;
  branchId?: string | null;
  accountId: string;
  entityType: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
}

export interface GeneratePayslipResult {
  success: boolean;
  payslipId?: string;
  message?: string;
  error?: string;
  periodStart?: string;
  periodEnd?: string;
  grossEarnings?: number;
  totalDeductions?: number;
  netPayable?: number;
  earningsBreakdown?: Record<string, number>;
  deductionsBreakdown?: Record<string, number>;
  entryCount?: number;
}

export async function generatePayslip(params: GeneratePayslipParams): Promise<GeneratePayslipResult> {
  const {
    orgId, branchId = null, accountId, entityType, entityId,
    periodStart, periodEnd, createdBy,
  } = params;

  try {
    // 1. Aggregate unprocessed entries for this period
    const { rows: summaryRows } = await pool.query<{
      entry_type: string; direction: string; total_amount: string;
    }>(`
      SELECT entry_type, direction, SUM(amount) AS total_amount
      FROM ledger_entries
      WHERE account_id     = $1
        AND status         = 'posted'
        AND effective_date BETWEEN $2 AND $3
        AND document_id IS NULL
      GROUP BY entry_type, direction
      ORDER BY entry_type, direction
    `, [accountId, periodStart, periodEnd]);

    if (!summaryRows.length) {
      return { success: false, message: "No unprocessed entries for this period" };
    }

    // 2. Split earnings / deductions
    const earningsBreakdown:   Record<string, number> = {};
    const deductionsBreakdown: Record<string, number> = {};
    let grossEarnings   = 0;
    let totalDeductions = 0;

    for (const row of summaryRows) {
      const amt = parseFloat(row.total_amount);
      if (row.direction === "CR" && EARNING_TYPES.includes(row.entry_type)) {
        earningsBreakdown[row.entry_type] = (earningsBreakdown[row.entry_type] ?? 0) + amt;
        grossEarnings += amt;
      } else if (row.direction === "DR" && DEDUCTION_TYPES.includes(row.entry_type)) {
        deductionsBreakdown[row.entry_type] = (deductionsBreakdown[row.entry_type] ?? 0) + amt;
        totalDeductions += amt;
      }
    }

    grossEarnings   = parseFloat(grossEarnings.toFixed(2));
    totalDeductions = parseFloat(totalDeductions.toFixed(2));
    const netPayable = parseFloat((grossEarnings - totalDeductions).toFixed(2));

    // 3. Entity name snapshot — staff.full_name (not `name`)
    let entityName: string | null = null;
    try {
      if (entityType === "hostess_profile") {
        const { rows } = await pool.query<{ full_name: string }>(
          `SELECT s.full_name FROM hostess_profiles hp JOIN staff s ON s.id = hp.staff_id WHERE hp.id = $1`,
          [entityId]
        );
        entityName = rows[0]?.full_name ?? null;
      } else {
        const { rows } = await pool.query<{ full_name: string }>(
          `SELECT full_name FROM staff WHERE id = $1`, [entityId]
        );
        entityName = rows[0]?.full_name ?? null;
      }
    } catch { /* non-fatal */ }

    // 4. Collect linked entry IDs
    const { rows: entryIdRows } = await pool.query<{ entry_ids: string[] | null }>(
      `SELECT ARRAY_AGG(id) AS entry_ids FROM ledger_entries
       WHERE account_id = $1 AND status = 'posted'
         AND effective_date BETWEEN $2 AND $3 AND document_id IS NULL`,
      [accountId, periodStart, periodEnd]
    );
    const ledgerEntryIds: string[] = entryIdRows[0]?.entry_ids ?? [];

    // 5. Upsert payslip (idempotent by UNIQUE constraint)
    const { rows: existingRows } = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM payslips WHERE account_id=$1 AND period_start=$2 AND period_end=$3 LIMIT 1`,
      [accountId, periodStart, periodEnd]
    );

    let payslipId: string;

    if (existingRows.length) {
      if (existingRows[0].status !== "draft") {
        return {
          success: false,
          message: `Payslip exists with status: ${existingRows[0].status}`,
          payslipId: existingRows[0].id,
        };
      }
      await pool.query(`
        UPDATE payslips SET
          entity_name          = $1,
          gross_earnings       = $2,
          total_deductions     = $3,
          net_payable          = $4,
          earnings_breakdown   = $5,
          deductions_breakdown = $6,
          ledger_entry_ids     = $7,
          updated_at           = NOW()
        WHERE id = $8
      `, [
        entityName, grossEarnings, totalDeductions, netPayable,
        earningsBreakdown, deductionsBreakdown,
        ledgerEntryIds, existingRows[0].id,
      ]);
      payslipId = existingRows[0].id;
    } else {
      const { rows: insertRows } = await pool.query<{ id: string }>(`
        INSERT INTO payslips (
          org_id, branch_id, account_id,
          entity_type, entity_id, entity_name,
          period_start, period_end,
          gross_earnings, total_deductions, net_payable,
          earnings_breakdown, deductions_breakdown,
          ledger_entry_ids,
          status, created_by, created_at, updated_at
        ) VALUES (
          $1,$2,$3, $4,$5,$6, $7,$8,
          $9,$10,$11, $12,$13, $14,
          'draft',$15,NOW(),NOW()
        ) RETURNING id
      `, [
        orgId, branchId, accountId,
        entityType, entityId, entityName,
        periodStart, periodEnd,
        grossEarnings, totalDeductions, netPayable,
        earningsBreakdown, deductionsBreakdown,
        ledgerEntryIds,
        createdBy,
      ]);
      payslipId = insertRows[0].id;
    }

    // 6. Link ledger_entries → payslip document
    if (ledgerEntryIds.length) {
      await pool.query(
        `UPDATE ledger_entries SET document_type='payslip', document_id=$1 WHERE id = ANY($2)`,
        [payslipId, ledgerEntryIds]
      );
    }

    return {
      success: true, payslipId,
      periodStart, periodEnd,
      grossEarnings, totalDeductions, netPayable,
      earningsBreakdown, deductionsBreakdown,
      entryCount: ledgerEntryIds.length,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PAYSLIP] generatePayslip failed:", msg);
    return { success: false, error: msg };
  }
}

export async function generateBranchPayslips(params: {
  orgId: string;
  branchId: string;
  accountType: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
}): Promise<{ results: Array<{ accountId: string } & GeneratePayslipResult>; succeeded: number; failed: number }> {
  const { orgId, branchId, accountType, periodStart, periodEnd, createdBy } = params;

  const { rows: accounts } = await pool.query<{
    id: string; entity_id: string; entity_type: string;
  }>(`
    SELECT id, entity_id, entity_type FROM ledger_accounts
    WHERE org_id=$1 AND branch_id=$2 AND account_type=$3 AND is_active=TRUE
  `, [orgId, branchId, accountType]);

  const results: Array<{ accountId: string } & GeneratePayslipResult> = [];
  for (const acct of accounts) {
    const r = await generatePayslip({
      orgId, branchId, accountId: acct.id,
      entityType: acct.entity_type, entityId: acct.entity_id,
      periodStart, periodEnd, createdBy,
    });
    results.push({ accountId: acct.id, ...r });
  }

  return {
    results,
    succeeded: results.filter(r => r.success).length,
    failed:    results.filter(r => !r.success).length,
  };
}

export async function issuePayslip(payslipId: string): Promise<{ success: boolean; payslip?: unknown; error?: string }> {
  const { rows } = await pool.query(
    `UPDATE payslips SET status='issued', updated_at=NOW() WHERE id=$1 AND status='draft' RETURNING *`,
    [payslipId]
  );
  if (!rows.length) return { success: false, error: "Not found or not draft" };
  return { success: true, payslip: rows[0] };
}
