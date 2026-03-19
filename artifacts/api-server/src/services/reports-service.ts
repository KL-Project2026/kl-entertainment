import { pool } from "@workspace/db";

export async function getRevenueReport(
  branchId: string,
  from: string,
  to: string
) {
  const { rows: daily } = await pool.query(
    `SELECT
       finalized_at::date AS date,
       COALESCE(SUM(total_amount), 0) AS amount,
       COUNT(*) AS order_count
     FROM orders
     WHERE branch_id = $1
       AND payment_status = 'paid'
       AND finalized_at::date BETWEEN $2 AND $3
     GROUP BY finalized_at::date
     ORDER BY finalized_at::date`,
    [branchId, from, to]
  );

  const { rows: byCategory } = await pool.query(
    `SELECT
       oi.item_type,
       COALESCE(SUM(oi.line_total), 0) AS total
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.branch_id = $1
       AND o.payment_status = 'paid'
       AND o.finalized_at::date BETWEEN $2 AND $3
       AND oi.item_type NOT IN ('discount')
     GROUP BY oi.item_type`,
    [branchId, from, to]
  );

  const { rows: byHour } = await pool.query(
    `SELECT
       EXTRACT(HOUR FROM finalized_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS hour,
       COALESCE(SUM(total_amount), 0) AS amount,
       COUNT(*) AS order_count
     FROM orders
     WHERE branch_id = $1
       AND payment_status = 'paid'
       AND finalized_at::date BETWEEN $2 AND $3
     GROUP BY EXTRACT(HOUR FROM finalized_at AT TIME ZONE 'Asia/Kuala_Lumpur')
     ORDER BY hour`,
    [branchId, from, to]
  );

  const totalAmount = daily.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalOrders = daily.reduce((sum, r) => sum + parseInt(r.order_count), 0);

  const catBreakdown: Record<string, number> = {};
  for (const row of byCategory) {
    catBreakdown[row.item_type] = parseFloat(row.total);
  }

  return {
    daily: daily.map((r) => ({
      date: r.date,
      amount: parseFloat(r.amount),
      orderCount: parseInt(r.order_count),
    })),
    hourly: byHour.map((r) => ({
      hour: parseInt(r.hour),
      amount: parseFloat(r.amount),
      orderCount: parseInt(r.order_count),
    })),
    total: Math.round(totalAmount * 100) / 100,
    totalOrders,
    byCategory: catBreakdown,
  };
}

export async function getOccupancyReport(branchId: string, month: string) {
  const monthStart = `${month}-01`;
  const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1, 0))
    .toISOString()
    .split("T")[0];

  const { rows } = await pool.query(
    `SELECT
       r.id,
       r.name AS room_name,
       r.room_type,
       r.hourly_rate,
       COUNT(DISTINCT res.id) AS reservation_count,
       COALESCE(SUM(
         EXTRACT(EPOCH FROM (
           COALESCE(res.actual_end_time, res.expected_end_time) -
           COALESCE(res.check_in_at, res.scheduled_date)
         )) / 3600
       ), 0) AS total_hours,
       COALESCE(SUM(oi.line_total), 0) AS room_revenue
     FROM rooms r
     LEFT JOIN reservations res ON res.room_id = r.id
       AND res.status IN ('checked_in', 'checked_out', 'completed')
       AND res.scheduled_date BETWEEN $2 AND $3
     LEFT JOIN orders o ON o.reservation_id = res.id AND o.payment_status = 'paid'
     LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.item_type = 'room_charge'
     WHERE r.branch_id = $1 AND r.deleted_at IS NULL
     GROUP BY r.id, r.name, r.room_type, r.hourly_rate
     ORDER BY r.room_type, r.name`,
    [branchId, monthStart, monthEnd]
  );

  const daysInMonth =
    new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1, 0)).getDate();
  const availableHoursPerRoom = daysInMonth * 14; // assume 14 operating hours/day

  const byRoom = rows.map((r) => {
    const totalHours = parseFloat(r.total_hours) || 0;
    return {
      roomId: r.id,
      roomName: r.room_name,
      roomType: r.room_type,
      reservationCount: parseInt(r.reservation_count),
      totalHours: Math.round(totalHours * 10) / 10,
      revenue: parseFloat(r.room_revenue) || 0,
      occupancyPct:
        availableHoursPerRoom > 0
          ? Math.round((totalHours / availableHoursPerRoom) * 100)
          : 0,
    };
  });

  const totalRevenue = byRoom.reduce((sum, r) => sum + r.revenue, 0);
  const avgOccupancy =
    byRoom.length > 0
      ? Math.round(byRoom.reduce((sum, r) => sum + r.occupancyPct, 0) / byRoom.length)
      : 0;

  return {
    month,
    byRoom,
    overall: avgOccupancy / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

export async function getCommissionsReport(branchId: string, month: string) {
  const monthStart = `${month}-01`;
  const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1, 0))
    .toISOString()
    .split("T")[0];

  const { rows: hostessRows } = await pool.query(
    `SELECT
       s.id,
       s.full_name,
       s.role,
       COUNT(oi.id) AS sessions,
       COALESCE(SUM(oi.line_total), 0) AS gross_fees,
       COALESCE(SUM(e.amount) FILTER (WHERE e.category = 'agent_commission'), 0) AS agent_deductions,
       COALESCE(SUM(a.lateMinutes), 0) AS late_minutes,
       COALESCE(SUM(att.penalty_amount), 0) AS penalties
     FROM staff s
     LEFT JOIN order_items oi ON oi.staff_ref_id = s.id AND oi.item_type = 'hostess_fee'
     LEFT JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'paid'
       AND o.finalized_at::date BETWEEN $2 AND $3
     LEFT JOIN expenses e ON e.reference_id = s.id AND e.category = 'agent_commission'
       AND e.expense_date BETWEEN $2 AND $3
     LEFT JOIN (
       SELECT staff_id, SUM(late_minutes) AS lateMinutes FROM attendance
       WHERE work_date BETWEEN $2 AND $3 GROUP BY staff_id
     ) a ON a.staff_id = s.id
     LEFT JOIN (
       SELECT staff_id, SUM(penalty_amount) AS penalty_amount FROM attendance
       WHERE work_date BETWEEN $2 AND $3 GROUP BY staff_id
     ) att ON att.staff_id = s.id
     WHERE s.branch_id = $1 AND s.role = 'hostess' AND s.is_active = true
     GROUP BY s.id, s.full_name, s.role`,
    [branchId, monthStart, monthEnd]
  );

  const { rows: agentRows } = await pool.query(
    `SELECT
       ag.id,
       ag.name,
       COUNT(DISTINCT ap.id) AS payout_count,
       COALESCE(SUM(ap.amount_myr), 0) AS total_paid_myr,
       ag.preferred_currency,
       ag.commission_rate
     FROM agents ag
     LEFT JOIN agent_payouts ap ON ap.agent_id = ag.id
       AND ap.period_from >= $2 AND ap.period_to <= $3
     WHERE ag.org_id = (SELECT org_id FROM branches WHERE id = $1)
     GROUP BY ag.id, ag.name, ag.preferred_currency, ag.commission_rate`,
    [branchId, monthStart, monthEnd]
  );

  const hostessTotals = {
    totalSessions: hostessRows.reduce((s, r) => s + parseInt(r.sessions), 0),
    totalGrossFees: hostessRows.reduce((s, r) => s + parseFloat(r.gross_fees), 0),
    totalPenalties: hostessRows.reduce((s, r) => s + parseFloat(r.penalties || 0), 0),
  };

  const agentTotalPaid = agentRows.reduce((s, r) => s + parseFloat(r.total_paid_myr), 0);

  return {
    month,
    hostesses: hostessRows.map((r) => ({
      staffId: r.id,
      name: r.full_name,
      sessions: parseInt(r.sessions),
      grossFees: parseFloat(r.gross_fees),
      agentDeductions: parseFloat(r.agent_deductions || 0),
      penalties: parseFloat(r.penalties || 0),
      netEarnings: parseFloat(r.gross_fees) - parseFloat(r.agent_deductions || 0) - parseFloat(r.penalties || 0),
    })),
    agents: agentRows.map((r) => ({
      agentId: r.id,
      name: r.name,
      payoutCount: parseInt(r.payout_count),
      totalPaidMyr: parseFloat(r.total_paid_myr),
      commissionRate: parseFloat(r.commission_rate),
      preferredCurrency: r.preferred_currency,
    })),
    summary: {
      ...hostessTotals,
      totalAgentCommissionsPaid: Math.round(agentTotalPaid * 100) / 100,
      totalPaid: Math.round((agentTotalPaid + hostessTotals.totalPenalties) * 100) / 100,
    },
  };
}
