import { pool } from "@workspace/db";

export interface PnLResult {
  branchId: string;
  period: { start: string; end: string };
  revenue: {
    room: number;
    hostess: number;
    product: number;
    pickup: number;
    extension: number;
    gross: number;
  };
  expenses: {
    breakdown: Record<string, number>;
    total: number;
  };
  netProfit: number;
}

export async function calculateBranchPnL(
  branchId: string,
  periodStart: string,
  periodEnd: string
): Promise<PnLResult> {
  const { rows: revRows } = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN oi.item_type = 'room_charge'      THEN oi.line_total ELSE 0 END), 0) AS room_revenue,
      COALESCE(SUM(CASE WHEN oi.item_type = 'hostess_fee'      THEN oi.line_total ELSE 0 END), 0) AS hostess_revenue,
      COALESCE(SUM(CASE WHEN oi.item_type = 'product'          THEN oi.line_total ELSE 0 END), 0) AS product_revenue,
      COALESCE(SUM(CASE WHEN oi.item_type = 'pickup_fee'       THEN oi.line_total ELSE 0 END), 0) AS pickup_revenue,
      COALESCE(SUM(CASE WHEN oi.item_type = 'extension_charge' THEN oi.line_total ELSE 0 END), 0) AS extension_revenue,
      COALESCE(SUM(o.total_amount), 0) AS gross_revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.branch_id = $1
      AND o.payment_status = 'paid'
      AND o.finalized_at::date BETWEEN $2 AND $3
      AND oi.item_type NOT IN ('discount')`,
    [branchId, periodStart, periodEnd]
  );

  const { rows: expRows } = await pool.query(
    `SELECT category, COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE branch_id = $1
       AND expense_date BETWEEN $2 AND $3
     GROUP BY category`,
    [branchId, periodStart, periodEnd]
  );

  const rev = revRows[0];
  const grossRevenue = parseFloat(rev.gross_revenue) || 0;

  const expenseBreakdown: Record<string, number> = {};
  let totalExpenses = 0;
  for (const row of expRows) {
    const amt = parseFloat(row.total) || 0;
    expenseBreakdown[row.category] = amt;
    totalExpenses += amt;
  }

  return {
    branchId,
    period: { start: periodStart, end: periodEnd },
    revenue: {
      room: parseFloat(rev.room_revenue) || 0,
      hostess: parseFloat(rev.hostess_revenue) || 0,
      product: parseFloat(rev.product_revenue) || 0,
      pickup: parseFloat(rev.pickup_revenue) || 0,
      extension: parseFloat(rev.extension_revenue) || 0,
      gross: grossRevenue,
    },
    expenses: {
      breakdown: expenseBreakdown,
      total: Math.round(totalExpenses * 100) / 100,
    },
    netProfit: Math.round((grossRevenue - totalExpenses) * 100) / 100,
  };
}

export async function calculateShareholderSettlement(
  branchId: string,
  shareholderId: string,
  periodStart: string,
  periodEnd: string
) {
  const pnl = await calculateBranchPnL(branchId, periodStart, periodEnd);

  const { rows: bsRows } = await pool.query(
    `SELECT equity_pct, agreed_rate FROM branch_shareholders
     WHERE branch_id = $1 AND shareholder_id = $2
       AND effective_from <= $3
       AND (effective_to IS NULL OR effective_to >= $4)
     ORDER BY effective_from DESC LIMIT 1`,
    [branchId, shareholderId, periodEnd, periodStart]
  );

  if (!bsRows.length) throw new Error("SHAREHOLDER_NOT_FOUND_FOR_BRANCH");

  const equityPct = parseFloat(bsRows[0].agreed_rate ?? bsRows[0].equity_pct);
  const settlementMyr = Math.round(pnl.netProfit * equityPct * 100) / 100;

  const { rows: shRows } = await pool.query(
    "SELECT preferred_currency FROM shareholders WHERE id = $1",
    [shareholderId]
  );
  const preferredCcy = shRows[0]?.preferred_currency ?? "MYR";

  let fxRate = 1.0;
  if (preferredCcy !== "MYR") {
    const { rows: fxRows } = await pool.query(
      "SELECT rate FROM fx_rates WHERE base_ccy = $1 AND quote_ccy = $2",
      ["MYR", preferredCcy]
    );
    fxRate = parseFloat(fxRows[0]?.rate) || 1.0;
  }

  return {
    branchId,
    shareholderId,
    periodStart,
    periodEnd,
    grossRevenue: pnl.revenue.gross,
    totalExpenses: pnl.expenses.total,
    netProfit: pnl.netProfit,
    equityPctSnapshot: equityPct,
    settlementAmountMyr: settlementMyr,
    payoutCurrency: preferredCcy,
    fxRate,
    settlementAmountFx: Math.round(settlementMyr * fxRate * 100) / 100,
    revenueBreakdown: pnl.revenue,
    expenseBreakdown: pnl.expenses.breakdown,
    status: "draft",
  };
}

export async function getInvestorDashboardSnapshot(shareholderId: string) {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const { rows: branches } = await pool.query(
    `SELECT b.id, b.name, b.internal_code, bs.equity_pct
     FROM branches b
     JOIN branch_shareholders bs ON bs.branch_id = b.id
     WHERE bs.shareholder_id = $1
       AND (bs.effective_to IS NULL OR bs.effective_to >= NOW())
     ORDER BY b.name`,
    [shareholderId]
  );

  const branchData = await Promise.all(
    branches.map(async (b) => {
      const [todayRev, monthRev, rooms] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
           FROM orders WHERE branch_id = $1 AND payment_status = 'paid'
           AND finalized_at::date = $2`,
          [b.id, today]
        ),
        pool.query(
          `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
           FROM orders WHERE branch_id = $1 AND payment_status = 'paid'
           AND finalized_at::date >= $2`,
          [b.id, monthStart]
        ),
        pool.query(
          `SELECT status, COUNT(*) AS count FROM rooms WHERE branch_id = $1 GROUP BY status`,
          [b.id]
        ),
      ]);

      const roomCounts = rooms.rows.reduce(
        (acc: Record<string, number>, r) => ({ ...acc, [r.status]: parseInt(r.count) }),
        {}
      );
      const totalRooms = Object.values(roomCounts).reduce((a, b) => a + b, 0);
      const equityPct = parseFloat(b.equity_pct);
      const monthRevAmt = parseFloat(monthRev.rows[0].revenue);

      return {
        branchId: b.id,
        branchName: b.name,
        internalCode: b.internal_code,
        equityPct,
        today: {
          revenue: parseFloat(todayRev.rows[0].revenue),
          orderCount: parseInt(todayRev.rows[0].orders),
        },
        thisMonth: {
          revenue: monthRevAmt,
          orderCount: parseInt(monthRev.rows[0].orders),
          estimatedPayout: Math.round(monthRevAmt * equityPct * 100) / 100,
        },
        rooms: {
          total: totalRooms,
          available: roomCounts["available"] || 0,
          occupied: roomCounts["occupied"] || 0,
          reserved: roomCounts["reserved"] || 0,
          occupancyPct:
            totalRooms > 0
              ? Math.round(((roomCounts["occupied"] || 0) / totalRooms) * 100)
              : 0,
        },
      };
    })
  );

  return { branches: branchData, updatedAt: new Date().toISOString() };
}

export async function emitInvestorRevenueUpdate(
  io: import("socket.io").Server,
  branchId: string,
  orderData: { order_no: string; total_amount: number; payment_method: string }
) {
  const { rows } = await pool.query(
    `SELECT shareholder_id FROM branch_shareholders
     WHERE branch_id = $1 AND (effective_to IS NULL OR effective_to >= NOW())`,
    [branchId]
  );
  for (const row of rows) {
    io.to(`investor:${row.shareholder_id}`).emit("revenue_update", {
      branchId,
      orderNo: orderData.order_no,
      totalAmount: orderData.total_amount,
      paymentMethod: orderData.payment_method,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function emitInvestorReservationUpdate(
  io: import("socket.io").Server,
  branchId: string,
  reservationData: { reservation_no: string; status: string; room_name?: string; guest_count?: number }
) {
  const { rows } = await pool.query(
    `SELECT shareholder_id FROM branch_shareholders
     WHERE branch_id = $1 AND (effective_to IS NULL OR effective_to >= NOW())`,
    [branchId]
  );
  for (const row of rows) {
    io.to(`investor:${row.shareholder_id}`).emit("reservation_update", {
      branchId,
      reservationNo: reservationData.reservation_no,
      status: reservationData.status,
      roomName: reservationData.room_name,
      guestCount: reservationData.guest_count,
      updatedAt: new Date().toISOString(),
    });
  }
}
