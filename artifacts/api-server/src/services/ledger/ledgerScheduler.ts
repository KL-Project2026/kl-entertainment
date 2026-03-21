// MIGRATION: .NET — Hangfire RecurringJob (NightlyBatchJob)
import { auditAllBalances, retryFailedEntries } from "./ledgerAudit";
import { generateBranchPayslips } from "./payslipService";

interface BatchLogEntry {
  step:      string;
  error?:    string;
  [key: string]: unknown;
}

export async function runNightlyBatch(params: {
  orgId:     string;
  branchIds?: string[];
}): Promise<{ success: boolean; duration: number; log: BatchLogEntry[] }> {
  const { orgId, branchIds = [] } = params;
  const log:       BatchLogEntry[] = [];
  const startTime  = Date.now();

  console.log("[BATCH] Start:", new Date().toISOString(), "org:", orgId);

  // 1. Balance integrity audit + auto-fix
  try {
    const audit = await auditAllBalances({ orgId, autoFix: true });
    log.push({ step: "balance_audit", ...audit });
    console.log("[BATCH] Audit:", audit);
  } catch (err) {
    log.push({ step: "balance_audit", error: err instanceof Error ? err.message : String(err) });
  }

  // 2. Retry failed queue entries
  try {
    const retry = await retryFailedEntries({ orgId });
    log.push({ step: "retry_failed", ...retry });
    console.log("[BATCH] Retry:", retry);
  } catch (err) {
    log.push({ step: "retry_failed", error: err instanceof Error ? err.message : String(err) });
  }

  // 3. On 1st of month: auto-generate prior month payslips for all branches
  const today = new Date();
  if (today.getDate() === 1) {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const pStart    = lastMonth.toISOString().split("T")[0];
    const pEnd      = new Date(today.getFullYear(), today.getMonth(), 0)
                        .toISOString().split("T")[0];

    for (const branchId of branchIds) {
      for (const acType of ["hostess", "driver", "staff"] as const) {
        try {
          const r = await generateBranchPayslips({
            orgId, branchId, accountType: acType,
            periodStart: pStart, periodEnd: pEnd,
            createdBy: "system",
          });
          log.push({ step: `payslip_${acType}_${branchId}`, ...r });
        } catch (err) {
          log.push({
            step: `payslip_${acType}_${branchId}`,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[BATCH] Done in ${duration}ms`);
  return { success: true, duration, log };
}
