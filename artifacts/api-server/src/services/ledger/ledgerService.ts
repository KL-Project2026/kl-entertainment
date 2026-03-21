// MIGRATION: .NET — LedgerService (LedgerSlice)
import { pool } from "@workspace/db";

export interface PostEntryParams {
  orgId: string;
  branchId?: string | null;
  accountId: string;
  entryType: string;
  direction: "DR" | "CR";
  amount: number;
  currency?: string;
  grossAmount?: number | null;
  agentShare?: number;
  hostessNet?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  contraAccountId?: string | null;
  effectiveDate?: string | null;
  accountingPeriod?: string | null;
  description?: string | null;
  referenceNo?: string | null;
  auditNote?: string | null;
  postedBy: string;
  ipAddress?: string | null;
}

export interface PostEntryResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Post a single ledger entry.
 * NON-BLOCKING — failures are queued and logged, never thrown.
 */
export async function postEntry(params: PostEntryParams): Promise<PostEntryResult> {
  const {
    orgId, branchId = null, accountId, entryType,
    direction, amount, currency = "MYR",
    grossAmount = null, agentShare = 0, hostessNet = null,
    sourceType = null, sourceId = null, contraAccountId = null,
    effectiveDate, accountingPeriod, description = null,
    referenceNo = null, auditNote = null, postedBy, ipAddress = null,
  } = params;

  try {
    if (!accountId)  throw new Error("accountId required");
    if (!entryType)  throw new Error("entryType required");
    if (!["DR", "CR"].includes(direction)) throw new Error("direction must be DR or CR");
    if (!amount || amount <= 0)            throw new Error("amount must be positive");
    if (!postedBy)   throw new Error("postedBy (staff.id) required");

    const today   = new Date();
    const effDate = effectiveDate ?? today.toISOString().split("T")[0];
    const period  = accountingPeriod ?? currentPeriod();

    const { rows } = await pool.query<{ id: string }>(`
      INSERT INTO ledger_entries (
        org_id, branch_id, account_id,
        entry_type, direction, amount, currency,
        gross_amount, agent_share, hostess_net,
        source_type, source_id,
        contra_account_id,
        effective_date, accounting_period,
        description, reference_no,
        audit_note, ip_address,
        posted_by, posted_at, status,
        created_at
      ) VALUES (
        $1,  $2,  $3,
        $4,  $5,  $6,  $7,
        $8,  $9,  $10,
        $11, $12,
        $13,
        $14, $15,
        $16, $17,
        $18, $19,
        $20, NOW(), 'posted', NOW()
      ) RETURNING id
    `, [
      orgId, branchId, accountId,
      entryType, direction, amount, currency,
      grossAmount, agentShare, hostessNet,
      sourceType, sourceId,
      contraAccountId,
      effDate, period,
      description, referenceNo,
      auditNote, ipAddress,
      postedBy,
    ]);

    await updateBalanceCache(accountId, direction, amount);
    return { success: true, entryId: rows[0].id };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LEDGER] postEntry failed:", { error: msg, accountId, entryType, amount });
    try {
      await pool.query(`
        INSERT INTO failed_ledger_queue (org_id, entry_type, payload, error_message)
        VALUES ($1, $2, $3, $4)
      `, [
        orgId, entryType,
        JSON.stringify({ orgId, branchId, accountId, entryType, direction, amount, currency, sourceType, sourceId, effectiveDate, postedBy }),
        msg,
      ]);
    } catch (qErr) {
      console.error("[LEDGER] Queue insert failed:", qErr instanceof Error ? qErr.message : qErr);
    }
    return { success: false, error: msg };
  }
}

export interface PostCommissionParams {
  orgId: string;
  branchId?: string | null;
  hostessProfileId: string;
  reservationId: string;
  entryType: string;
  grossAmount: number;
  agentId?: string | null;
  contractId?: string | null;
  agentFeeRate?: number;
  currency?: string;
  postedBy: string;
  ipAddress?: string | null;
}

/**
 * Post commission with automatic agent share split.
 * ✅ agencyShare → agentShare, agencies → agents
 */
export async function postCommission(params: PostCommissionParams): Promise<PostEntryResult & {
  agentEntryId?: string | null;
  grossAmount?: number;
  agentShare?: number;
  hostessNet?: number;
}> {
  const {
    orgId, branchId = null, hostessProfileId, reservationId,
    entryType, grossAmount, agentId = null, contractId = null,
    agentFeeRate = 0, currency = "MYR", postedBy, ipAddress = null,
  } = params;

  try {
    const { rows: acctRows } = await pool.query<{ id: string }>(`
      SELECT id FROM ledger_accounts
      WHERE account_type = 'hostess'
        AND entity_id    = $1
        AND org_id       = $2
        AND is_active    = TRUE
      LIMIT 1
    `, [hostessProfileId, orgId]);

    if (!acctRows.length) {
      throw new Error(`No ledger account for hostess_profile: ${hostessProfileId}`);
    }

    const agentShare = agentId && agentFeeRate > 0
      ? parseFloat((grossAmount * agentFeeRate).toFixed(2))
      : 0;
    const hostessNet = parseFloat((grossAmount - agentShare).toFixed(2));

    const today   = new Date();
    const period  = currentPeriod();
    const effDate = today.toISOString().split("T")[0];

    const hostessResult = await postEntry({
      orgId, branchId,
      accountId:        acctRows[0].id,
      entryType,
      direction:        "CR",
      amount:           hostessNet > 0 ? hostessNet : grossAmount,
      currency,
      grossAmount,
      agentShare,
      hostessNet,
      sourceType:       "reservation",
      sourceId:         reservationId,
      effectiveDate:    effDate,
      accountingPeriod: period,
      description:      `${entryType} — reservation ${reservationId}`,
      auditNote:        contractId ? `agent_contract:${contractId}` : "direct_hire",
      postedBy, ipAddress,
    });

    let agentEntryId: string | null = null;
    if (agentId && agentShare > 0) {
      const { rows: agentAcctRows } = await pool.query<{ id: string }>(`
        SELECT id FROM ledger_accounts
        WHERE account_type = 'agent'
          AND entity_id    = $1
          AND org_id       = $2
          AND is_active    = TRUE
        LIMIT 1
      `, [agentId, orgId]);

      if (agentAcctRows.length) {
        const agentResult = await postEntry({
          orgId, branchId,
          accountId:        agentAcctRows[0].id,
          entryType:        "fee_accrued",
          direction:        "CR",
          amount:           agentShare,
          currency,
          sourceType:       "reservation",
          sourceId:         reservationId,
          contraAccountId:  acctRows[0].id,
          effectiveDate:    effDate,
          accountingPeriod: period,
          description:      `Agent fee accrual — ${entryType} — reservation ${reservationId}`,
          auditNote:        `hostess_profile:${hostessProfileId} rate:${agentFeeRate}`,
          postedBy, ipAddress,
        });
        agentEntryId = agentResult.entryId ?? null;
      }
    }

    return {
      success:      hostessResult.success,
      entryId:      hostessResult.entryId,
      agentEntryId,
      grossAmount,
      agentShare,
      hostessNet,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LEDGER] postCommission failed:", msg);
    return { success: false, error: msg };
  }
}

export async function updateBalanceCache(
  accountId: string,
  direction: "DR" | "CR",
  amount: number
): Promise<void> {
  try {
    const delta = direction === "CR" ? amount : -amount;
    await pool.query(`
      UPDATE ledger_accounts
      SET balance_cache      = balance_cache + $1,
          balance_updated_at = NOW(),
          updated_at         = NOW()
      WHERE id = $2
    `, [delta, accountId]);
  } catch (err) {
    console.error("[LEDGER] updateBalanceCache failed:", err instanceof Error ? err.message : err);
  }
}

export async function recalculateBalance(accountId: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    const { rows } = await pool.query<{ true_balance: string }>(`
      SELECT COALESCE(SUM(
        CASE
          WHEN direction = 'CR' THEN  amount
          WHEN direction = 'DR' THEN -amount
        END
      ), 0.00) AS true_balance
      FROM ledger_entries
      WHERE account_id = $1 AND status = 'posted'
    `, [accountId]);

    const balance = parseFloat(rows[0].true_balance);
    await pool.query(`
      UPDATE ledger_accounts
      SET balance_cache      = $1,
          balance_updated_at = NOW(),
          updated_at         = NOW()
      WHERE id = $2
    `, [balance, accountId]);

    return { success: true, balance };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LEDGER] recalculateBalance failed:", msg);
    return { success: false, error: msg };
  }
}

export async function reverseEntry(params: {
  originalEntryId: string;
  reason: string;
  postedBy: string;
  ipAddress?: string | null;
}): Promise<PostEntryResult> {
  const { originalEntryId, reason, postedBy, ipAddress = null } = params;
  try {
    const { rows } = await pool.query<{
      org_id: string; branch_id: string | null; account_id: string;
      entry_type: string; direction: string; amount: string;
      currency: string; source_type: string | null; source_id: string | null;
      description: string | null; status: string;
    }>(`SELECT * FROM ledger_entries WHERE id = $1`, [originalEntryId]);

    if (!rows.length) throw new Error(`Entry not found: ${originalEntryId}`);
    const o = rows[0];
    if (o.status === "reversed") throw new Error("Entry already reversed");

    const reverseResult = await postEntry({
      orgId:       o.org_id,
      branchId:    o.branch_id,
      accountId:   o.account_id,
      entryType:   o.entry_type,
      direction:   o.direction === "CR" ? "DR" : "CR",
      amount:      parseFloat(o.amount),
      currency:    o.currency,
      sourceType:  o.source_type,
      sourceId:    o.source_id,
      effectiveDate: new Date().toISOString().split("T")[0],
      description: `REVERSAL: ${o.description ?? o.entry_type}`,
      auditNote:   `reversal_of:${originalEntryId} reason:${reason}`,
      postedBy, ipAddress,
    });

    if (reverseResult.success) {
      await pool.query(`
        UPDATE ledger_entries
        SET status               = 'reversed',
            reversed_by_entry_id = $1,
            reversal_reason      = $2
        WHERE id = $3
      `, [reverseResult.entryId, reason, originalEntryId]);
      await recalculateBalance(o.account_id);
    }

    return reverseResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LEDGER] reverseEntry failed:", msg);
    return { success: false, error: msg };
  }
}

export async function getBalance(params: {
  orgId: string;
  accountType: string;
  entityId: string;
}): Promise<{ success: boolean; balance?: number; source?: string; error?: string }> {
  const { orgId, accountType, entityId } = params;
  try {
    const { rows } = await pool.query<{
      id: string; balance_cache: string; balance_updated_at: string | null;
    }>(`
      SELECT id, balance_cache, balance_updated_at
      FROM ledger_accounts
      WHERE org_id       = $1
        AND account_type = $2
        AND entity_id    = $3
        AND is_active    = TRUE
      LIMIT 1
    `, [orgId, accountType, entityId]);

    if (!rows.length) return { success: false, error: "Account not found" };

    const acct  = rows[0];
    const ageMs = acct.balance_updated_at
      ? Date.now() - new Date(acct.balance_updated_at).getTime()
      : Infinity;

    if (ageMs > 3_600_000) {
      const recalc = await recalculateBalance(acct.id);
      return { success: true, balance: recalc.balance, source: "recalculated" };
    }

    return { success: true, balance: parseFloat(acct.balance_cache), source: "cache" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
