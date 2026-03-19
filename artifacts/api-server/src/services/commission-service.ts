import { pool } from "@workspace/db";

export interface CommissionRecord {
  staffId?: string;
  agentId?: string;
  orderId: string;
  role?: string;
  grossAmount?: number;
  agentCut?: number;
  netAmount?: number;
  amount?: number;
  type: "hostess_session" | "pickup_fee" | "agent_commission";
}

export interface EarningsSummary {
  sessions: number;
  grossEarnings: number;
  agentDeductions: number;
  penalties: number;
  netEarnings: number;
}

/**
 * Calculate all commissions for a finalized order.
 * Pure logic — processes hostess_fee and pickup_fee order items.
 */
export async function calculateOrderCommissions(orderId: string): Promise<CommissionRecord[]> {
  const { rows: items } = await pool.query(
    `SELECT oi.id, oi.item_type, oi.line_total, oi.staff_ref_id,
            s.commission_config, s.agent_id, s.role,
            a.commission_rate AS agent_rate, a.commission_type AS agent_type
     FROM order_items oi
     LEFT JOIN staff s ON s.id = oi.staff_ref_id
     LEFT JOIN agents a ON a.id = s.agent_id
     WHERE oi.order_id = $1
       AND oi.item_type IN ('hostess_fee', 'pickup_fee')`,
    [orderId]
  );

  const commissions: CommissionRecord[] = [];

  for (const item of items as Record<string, unknown>[]) {
    if (item.item_type === "hostess_fee" && item.staff_ref_id) {
      const hostessGross = parseFloat(item.line_total as string);
      let agentCut = 0;

      if (item.agent_id && item.agent_rate) {
        agentCut = Math.round(hostessGross * parseFloat(item.agent_rate as string) * 100) / 100;
      }
      const hostessNet = Math.round((hostessGross - agentCut) * 100) / 100;

      commissions.push({
        staffId: item.staff_ref_id as string,
        role: "hostess",
        orderId,
        grossAmount: hostessGross,
        agentId: (item.agent_id as string) ?? undefined,
        agentCut,
        netAmount: hostessNet,
        type: "hostess_session",
      });

      if (agentCut > 0 && item.agent_id) {
        commissions.push({
          agentId: item.agent_id as string,
          orderId,
          amount: agentCut,
          type: "agent_commission",
        });
      }
    }

    if (item.item_type === "pickup_fee" && item.staff_ref_id) {
      commissions.push({
        staffId: item.staff_ref_id as string,
        role: "driver",
        orderId,
        amount: parseFloat(item.line_total as string),
        type: "pickup_fee",
      });
    }
  }

  // Write agent commissions to expenses and update agent credit_balance
  for (const c of commissions) {
    if (c.type === "agent_commission" && c.agentId && c.amount) {
      await pool.query(
        `INSERT INTO expenses (branch_id, category, description, amount, expense_date,
                               reference_type, reference_id, period_month)
         SELECT o.branch_id, 'agent_commission',
                'Agent commission - Order ' || o.order_no,
                $1, CURRENT_DATE, 'order', $2,
                TO_CHAR(CURRENT_DATE, 'YYYY-MM')
         FROM orders o WHERE o.id = $2`,
        [c.amount, orderId]
      );
      await pool.query(
        "UPDATE agents SET credit_balance = credit_balance + $1 WHERE id = $2",
        [c.amount, c.agentId]
      );
    }
  }

  return commissions;
}

/**
 * Get staff earnings summary for a date range.
 */
export async function getStaffEarningsSummary(
  staffId: string,
  fromDate: string,
  toDate: string
): Promise<EarningsSummary> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT oi.order_id)::int AS sessions,
       COALESCE(SUM(oi.line_total), 0) AS gross_earnings,
       COALESCE((
         SELECT SUM(e.amount)
         FROM expenses e
         WHERE e.reference_type = 'order'
           AND e.category = 'agent_commission'
           AND e.reference_id IN (
             SELECT oi2.order_id FROM order_items oi2
             WHERE oi2.staff_ref_id = $1 AND oi2.item_type = 'hostess_fee'
           )
           AND e.expense_date BETWEEN $2 AND $3
       ), 0) AS agent_deductions,
       COALESCE((
         SELECT SUM(a.penalty_amount)
         FROM attendance a
         WHERE a.staff_id = $1 AND a.work_date BETWEEN $2 AND $3
       ), 0) AS penalties
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.staff_ref_id = $1
       AND oi.item_type = 'hostess_fee'
       AND o.payment_status = 'paid'
       AND DATE(o.finalized_at) BETWEEN $2 AND $3`,
    [staffId, fromDate, toDate]
  );

  const r = rows[0] as Record<string, unknown>;
  const gross = parseFloat(r.gross_earnings as string) || 0;
  const agentDed = parseFloat(r.agent_deductions as string) || 0;
  const penalties = parseFloat(r.penalties as string) || 0;

  return {
    sessions: parseInt(r.sessions as string) || 0,
    grossEarnings: gross,
    agentDeductions: agentDed,
    penalties,
    netEarnings: gross - agentDed - penalties,
  };
}

/**
 * Build agent commission statement for a period.
 */
export async function buildAgentStatement(agentId: string, from: string, to: string) {
  const { rows: agentRows } = await pool.query(
    `SELECT a.*, o.rate AS fx_rate
     FROM agents a
     LEFT JOIN fx_rates o ON o.from_currency = 'MYR' AND o.to_currency = a.preferred_currency
     WHERE a.id = $1`,
    [agentId]
  );
  if (!agentRows.length) throw new Error("AGENT_NOT_FOUND");
  const agent = agentRows[0] as Record<string, unknown>;

  const { rows: hostessRows } = await pool.query(
    `SELECT
       s.id AS staff_id, s.full_name AS name,
       COUNT(DISTINCT oi.order_id)::int AS sessions,
       COALESCE(SUM(oi.line_total), 0) AS hostess_gross
     FROM staff s
     JOIN order_items oi ON oi.staff_ref_id = s.id AND oi.item_type = 'hostess_fee'
     JOIN orders o ON o.id = oi.order_id
     WHERE s.agent_id = $1
       AND o.payment_status = 'paid'
       AND DATE(o.finalized_at) BETWEEN $2 AND $3
     GROUP BY s.id, s.full_name
     ORDER BY hostess_gross DESC`,
    [agentId, from, to]
  );

  const agentRate = parseFloat(agent.commission_rate as string) || 0;
  const fxRate = parseFloat(agent.fx_rate as string) || 1.0;

  const hostesses = (hostessRows as Record<string, unknown>[]).map((h) => {
    const gross = parseFloat(h.hostess_gross as string) || 0;
    const earned = Math.round(gross * agentRate * 100) / 100;
    return {
      staffId: h.staff_id,
      name: h.name,
      sessions: h.sessions,
      hostessGross: gross,
      agentCommissionRate: agentRate,
      agentEarned: earned,
    };
  });

  const totalEarned = hostesses.reduce((s, h) => s + h.agentEarned, 0);
  const previousBalance = parseFloat(agent.credit_balance as string) || 0;
  const totalDue = previousBalance + totalEarned;

  return {
    agentId,
    agentName: agent.name,
    period: { from, to },
    hostesses,
    totalEarned: Math.round(totalEarned * 100) / 100,
    previousBalance,
    totalDue: Math.round(totalDue * 100) / 100,
    preferredCurrency: agent.preferred_currency || "MYR",
    fxRate,
    amountInPreferredCurrency: Math.round(totalDue * fxRate * 100) / 100,
  };
}
