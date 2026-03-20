/**
 * investorReportJob.ts
 *
 * Nightly aggregation job — pre-aggregates data into investor_reports.
 *
 * ⚠️  RULE B: READ-ONLY on all live tables. Only WRITES to investor_reports.
 * ⚠️  Uses INSERT ... ON CONFLICT DO UPDATE (upsert) — idempotent, safe to re-run.
 * ⚠️  Test manually once: run via POST /api/admin/reports/regenerate
 *     before enabling the cron schedule below.
 */

import { pool } from "@workspace/db";

const ORG_ID = process.env["DEFAULT_ORG_ID"] ?? "00000000-0000-0000-0000-000000000001";

interface ReportRow {
  total_revenue:     string;
  room_revenue:      string;
  other_revenue:     string;
}

interface CommissionRow {
  total_commission: string;
}

interface UtilRow {
  total_rooms:      string;
  occupied_rooms:   string;
  total_sessions:   string;
  unique_customers: string;
  avg_spend:        string;
}

interface BranchRow {
  id:     string;
  org_id: string;
  name:   string;
}

/**
 * generateInvestorReport
 * Aggregates data for one branch and one month (period = "YYYY-MM").
 * SAFE: SELECT only on live tables; UPSERT on investor_reports.
 */
export async function generateInvestorReport(
  orgId:    string,
  branchId: string,
  period:   string,  // e.g. "2025-08"
): Promise<{ success: boolean; period: string; branchId: string; error?: string }> {
  console.log(`[InvestorJob] Generating report: org=${orgId} branch=${branchId} period=${period}`);

  try {
    // ── 1. Revenue from paid orders, broken down by order item type ──────────
    // item_type values: room_charge, extension_charge, hostess_fee, pickup_fee,
    //                   product, discount, other
    const revRes = await pool.query<ReportRow>(
      `SELECT
         COALESCE(SUM(oi.line_total), 0)::NUMERIC(15,2)                           AS total_revenue,
         COALESCE(SUM(CASE WHEN oi.item_type IN ('room_charge','extension_charge')
                           THEN oi.line_total ELSE 0 END), 0)::NUMERIC(15,2)      AS room_revenue,
         COALESCE(SUM(CASE WHEN oi.item_type NOT IN
                                ('room_charge','extension_charge','discount','hostess_fee')
                           THEN oi.line_total ELSE 0 END), 0)::NUMERIC(15,2)      AS other_revenue
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.branch_id = $1
         AND o.payment_status = 'paid'
         AND TO_CHAR(o.created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM') = $2`,
      [branchId, period],
    );
    const rev = revRes.rows[0] ?? { total_revenue: "0", room_revenue: "0", other_revenue: "0" };

    // ── 2. Commission expense — hostess session net payouts ──────────────────
    // JOIN through reservations to get branch scope
    const commRes = await pool.query<CommissionRow>(
      `SELECT COALESCE(SUM(hs.net_payout), 0)::NUMERIC(15,2) AS total_commission
       FROM hostess_sessions hs
       JOIN reservations r ON r.id = hs.reservation_id
       WHERE r.branch_id = $1
         AND TO_CHAR(hs.start_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM') = $2
         AND hs.end_at IS NOT NULL`,
      [branchId, period],
    );
    const totalCommission = parseFloat(commRes.rows[0]?.total_commission ?? "0");

    // ── 3. Room utilization ─────────────────────────────────────────────────
    const utilRes = await pool.query<UtilRow>(
      `SELECT
         COUNT(DISTINCT r.id)                                                        AS total_rooms,
         COUNT(DISTINCT CASE WHEN res.status IN ('checked_in','checked_out','extended')
                             THEN res.room_id END)                                   AS occupied_rooms,
         COUNT(DISTINCT res.id)                                                      AS total_sessions,
         COUNT(DISTINCT res.customer_id)                                             AS unique_customers,
         COALESCE(AVG(CASE WHEN o.payment_status = 'paid' THEN o.total_amount END), 0)
                                                                                     AS avg_spend
       FROM rooms r
       LEFT JOIN reservations res ON res.room_id = r.id
         AND TO_CHAR(res.start_time AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM') = $2
       LEFT JOIN orders o ON o.reservation_id = res.id
         AND o.payment_status = 'paid'
       WHERE r.branch_id = $1`,
      [branchId, period],
    );
    const util       = utilRes.rows[0] ?? { total_rooms: "0", occupied_rooms: "0", total_sessions: "0", unique_customers: "0", avg_spend: "0" };
    const totalRooms  = Math.max(parseInt(util.total_rooms, 10) || 1, 1);
    const occupied    = parseInt(util.occupied_rooms, 10) || 0;
    const utilPct     = parseFloat(((occupied / totalRooms) * 100).toFixed(2));

    // ── 4. P&L ────────────────────────────────────────────────────────────
    const totalRevenue  = parseFloat(rev.total_revenue);
    const roomRevenue   = parseFloat(rev.room_revenue);
    const otherRevenue  = parseFloat(rev.other_revenue);
    const totalOpCost   = totalCommission;
    const grossProfit   = totalRevenue - totalOpCost;
    const netProfit     = grossProfit; // MVP: SST not deducted from profit yet

    // ── 5. Get branch name ─────────────────────────────────────────────────
    const bRes = await pool.query<{ name: string }>(
      "SELECT name FROM branches WHERE id = $1",
      [branchId],
    );
    const branchName = bRes.rows[0]?.name ?? `Branch ${branchId}`;

    // ── 6. Upsert — safe to re-run ─────────────────────────────────────────
    await pool.query(
      `INSERT INTO investor_reports (
         org_id, branch_id, branch_name, period,
         total_revenue, room_revenue, beverage_revenue,
         food_revenue, package_revenue, other_revenue,
         total_operating_cost, total_commission_expense,
         gross_profit, net_profit,
         room_utilization_pct, total_sessions,
         unique_customers, avg_spend_per_session,
         generated_at, generated_by, currency_code
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, 0, 0, 0, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         NOW(), 'SYSTEM_NIGHTLY_JOB', 'MYR'
       )
       ON CONFLICT (org_id, branch_id, period) DO UPDATE SET
         branch_name             = EXCLUDED.branch_name,
         total_revenue           = EXCLUDED.total_revenue,
         room_revenue            = EXCLUDED.room_revenue,
         other_revenue           = EXCLUDED.other_revenue,
         total_operating_cost    = EXCLUDED.total_operating_cost,
         total_commission_expense = EXCLUDED.total_commission_expense,
         gross_profit            = EXCLUDED.gross_profit,
         net_profit              = EXCLUDED.net_profit,
         room_utilization_pct    = EXCLUDED.room_utilization_pct,
         total_sessions          = EXCLUDED.total_sessions,
         unique_customers        = EXCLUDED.unique_customers,
         avg_spend_per_session   = EXCLUDED.avg_spend_per_session,
         generated_at            = NOW(),
         generated_by            = 'SYSTEM_NIGHTLY_JOB'`,
      [
        orgId, branchId, branchName, period,
        totalRevenue, roomRevenue, otherRevenue,
        totalOpCost, totalCommission,
        grossProfit, netProfit,
        utilPct, parseInt(util.total_sessions, 10),
        parseInt(util.unique_customers, 10), parseFloat(util.avg_spend),
      ],
    );

    console.log(`[InvestorJob] ✅ Done: branch=${branchId} period=${period} revenue=${totalRevenue}`);
    return { success: true, period, branchId };
  } catch (err) {
    // ⚠️  Log but do NOT throw — allow other branches to continue
    const msg = (err as Error).message;
    console.error(`[InvestorJob] ❌ Failed: branch=${branchId} period=${period}`, msg);
    return { success: false, period, branchId, error: msg };
  }
}

/**
 * runNightlyJob
 * Iterates all active branches and generates reports for current + previous month.
 * Idempotent — safe to run multiple times.
 */
export async function runNightlyJob(): Promise<void> {
  console.log("[InvestorJob] Starting nightly aggregation...");

  const now      = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-indexed

  // Current month + previous month
  const periods: string[] = [
    `${curYear}-${String(curMonth).padStart(2, "0")}`,
  ];
  if (curMonth === 1) {
    periods.push(`${curYear - 1}-12`);
  } else {
    periods.push(`${curYear}-${String(curMonth - 1).padStart(2, "0")}`);
  }

  try {
    const { rows: branches } = await pool.query<BranchRow>(
      "SELECT id, org_id, name FROM branches WHERE is_active = true",
    );

    const results = [];
    for (const branch of branches) {
      const orgId = branch.org_id ?? ORG_ID;
      for (const period of periods) {
        const r = await generateInvestorReport(orgId, branch.id, period);
        results.push(r);
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed    = results.filter((r) => !r.success).length;
    console.log(`[InvestorJob] ✅ Nightly complete: ${succeeded} succeeded, ${failed} failed.`);
  } catch (err) {
    console.error("[InvestorJob] ❌ Job failed:", (err as Error).message);
  }
}

// ── Nightly cron — 02:00 AM Kuala Lumpur time ─────────────────────────────
// ⚠️  Uncomment ONLY after manual test via POST /api/admin/reports/regenerate
//     confirms correct output in investor_reports table.
//
// import cron from "node-cron";
// cron.schedule("0 2 * * *", () => {
//   console.log("[CRON] Running nightly investor report aggregation...");
//   void runNightlyJob();
// }, { timezone: "Asia/Kuala_Lumpur" });
// console.log("[InvestorJob] Nightly cron scheduled at 02:00 KL time");
