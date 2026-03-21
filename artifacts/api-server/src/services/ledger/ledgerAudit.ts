// MIGRATION: .NET — BackgroundService (Hangfire RecurringJob)
import { pool } from "@workspace/db";
import { recalculateBalance, postEntry, type PostEntryParams } from "./ledgerService";

export interface AuditMismatch {
  accountId:    string;
  accountType:  string;
  entityId:     string;
  cacheBalance: number;
  trueBalance:  number;
  diff:         number;
  fixed:        boolean;
}

export interface AuditResult {
  totalChecked: number;
  mismatches:   number;
  autoFixed:    number;
  details:      AuditMismatch[];
}

/**
 * Balance integrity audit — balance_cache vs actual ledger sum.
 */
export async function auditAllBalances(params: {
  orgId: string;
  autoFix?: boolean;
}): Promise<AuditResult> {
  const { orgId, autoFix = false } = params;
  const results: AuditMismatch[] = [];

  const { rows: accounts } = await pool.query<{
    id: string; account_type: string; entity_id: string; balance_cache: string;
  }>(
    `SELECT id, account_type, entity_id, balance_cache
     FROM ledger_accounts WHERE org_id=$1 AND is_active=TRUE`,
    [orgId]
  );

  for (const acct of accounts) {
    const { rows: actualRows } = await pool.query<{ true_balance: string }>(`
      SELECT COALESCE(SUM(
        CASE WHEN direction='CR' THEN amount WHEN direction='DR' THEN -amount END
      ), 0.00) AS true_balance
      FROM ledger_entries
      WHERE account_id=$1 AND status='posted'
    `, [acct.id]);

    const trueBalance  = parseFloat(actualRows[0].true_balance);
    const cacheBalance = parseFloat(acct.balance_cache);
    const diff         = Math.abs(trueBalance - cacheBalance);

    if (diff > 0.01) {
      console.warn("[AUDIT] Mismatch:", {
        accountId: acct.id, cache: cacheBalance, actual: trueBalance, diff,
      });

      const record: AuditMismatch = {
        accountId:    acct.id,
        accountType:  acct.account_type,
        entityId:     acct.entity_id,
        cacheBalance, trueBalance, diff, fixed: false,
      };

      if (autoFix) {
        await recalculateBalance(acct.id);
        record.fixed = true;
      }

      results.push(record);
    }
  }

  return {
    totalChecked: accounts.length,
    mismatches:   results.length,
    autoFixed:    results.filter(r => r.fixed).length,
    details:      results,
  };
}

/**
 * Retry failed ledger queue items (retry_count < 3, next_retry_at <= NOW()).
 */
export async function retryFailedEntries(params: { orgId: string }): Promise<{
  success: boolean; retried?: number; total?: number; error?: string;
}> {
  try {
    const { rows: failed } = await pool.query<{
      id: string; payload: string; retry_count: number;
    }>(`
      SELECT * FROM failed_ledger_queue
      WHERE org_id=$1 AND retry_count < 3 AND next_retry_at <= NOW()
      ORDER BY created_at ASC LIMIT 50
    `, [params.orgId]);

    let retried = 0;
    for (const item of failed) {
      try {
        const payload = JSON.parse(item.payload) as PostEntryParams;
        await postEntry(payload);
        await pool.query("DELETE FROM failed_ledger_queue WHERE id=$1", [item.id]);
        retried++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await pool.query(`
          UPDATE failed_ledger_queue
          SET retry_count   = retry_count + 1,
              last_error    = $1,
              next_retry_at = NOW() + INTERVAL '30 minutes'
          WHERE id = $2
        `, [msg, item.id]);
      }
    }

    return { success: true, retried, total: failed.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
