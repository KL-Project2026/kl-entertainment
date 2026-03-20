import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";

const router: IRouter = Router();

// POST /payments — 결제 처리 + 잔액 갱신 + 영수증 자동 발행
router.post(
  "/payments",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { invoice_id, amount, method, ref_no, notes } = req.body as Record<string, unknown>;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // get invoice
      const { rows: invRows } = await client.query(
        `SELECT i.*, b.internal_code FROM invoices i
         JOIN branches b ON b.id = i.branch_id WHERE i.id = $1`,
        [invoice_id]
      );
      if (!invRows.length) throw new Error("인보이스를 찾을 수 없습니다.");
      const invoice = invRows[0] as Record<string, unknown>;
      if (invoice.status === "void") throw new Error("취소된 인보이스입니다.");

      // insert payment
      const { rows: payRows } = await client.query(
        `INSERT INTO payments (invoice_id, branch_id, reservation_id, amount, currency, method, ref_no, received_by, notes)
         VALUES ($1,$2,$3,$4,'MYR',$5,$6,$7,$8) RETURNING *`,
        [invoice_id, invoice.branch_id, invoice.reservation_id ?? null,
         amount, method, ref_no ?? null, req.user!.id, notes ?? null]
      );
      const payment = payRows[0] as Record<string, unknown>;

      // recalculate total paid
      const { rows: sumRows } = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1 AND is_void = false`,
        [invoice_id]
      );
      const totalPaid = parseFloat(String((sumRows[0] as Record<string, unknown>).paid));
      const totalDue  = parseFloat(String(invoice.total_amount));
      const balance   = Math.max(0, totalDue - totalPaid);
      const status    = totalPaid >= totalDue ? "paid" : "partially_paid";

      await client.query(
        `UPDATE invoices SET status = $1, amount_paid = $2, balance_due = $3, updated_at = NOW() WHERE id = $4`,
        [status, totalPaid, balance, invoice_id]
      );

      // auto-issue receipt on full payment
      let receipt: Record<string, unknown> | null = null;
      if (totalPaid >= totalDue) {
        const { rows: noRows } = await client.query(
          `SELECT generate_receipt_no($1) AS no`,
          [String(invoice.internal_code ?? "KL01")]
        );
        const receiptNo = (noRows[0] as Record<string, unknown>).no as string;
        const { rows: recRows } = await client.query(
          `INSERT INTO receipts
             (receipt_no, order_id, branch_id, customer_id, customer_name,
              amount_paid, currency, payment_method, issued_by, invoice_id, payment_id)
           VALUES ($1,
             COALESCE((SELECT id FROM orders WHERE reservation_id=$2 LIMIT 1), gen_random_uuid()),
             $3, $4, $5, $6, 'MYR', $7, $8, $9, $10)
           RETURNING *`,
          [
            receiptNo, invoice.reservation_id, invoice.branch_id,
            invoice.customer_id ?? null, invoice.customer_name ?? null,
            totalPaid, method, req.user!.id, invoice_id, payment.id,
          ]
        );
        receipt = recRows[0] as Record<string, unknown>;
      }

      await client.query("COMMIT");
      res.status(201).json({
        success: true,
        data: { payment, invoice_status: status, balance_due: balance, receipt },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("payment error:", err);
      res.status(400).json({ error: (err as Error).message });
    } finally {
      client.release();
    }
  }
);

// GET /payments/invoice/:invoiceId — 인보이스별 결제 내역
router.get(
  "/payments/invoice/:invoiceId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT p.*, s.full_name AS received_by_name
         FROM payments p
         LEFT JOIN staff s ON p.received_by = s.id
         WHERE p.invoice_id = $1 AND p.is_void = false
         ORDER BY p.paid_at`,
        [req.params.invoiceId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("payments list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /accounts/staff/:id — Staff 계정 요약
router.get(
  "/accounts/staff/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    try {
      const { rows: attnRows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'present')  AS present_days,
           COUNT(*) FILTER (WHERE status = 'absent')   AS absent_days,
           COUNT(*) FILTER (WHERE status = 'late')     AS late_days,
           COALESCE(SUM(hours_worked), 0)              AS total_hours,
           COALESCE(SUM(penalty_amount), 0)            AS total_penalty
         FROM attendance
         WHERE staff_id = $1 AND TO_CHAR(work_date, 'YYYY-MM') = $2`,
        [req.params.id, month]
      );
      const { rows: sessRows } = await pool.query(
        `SELECT
           COUNT(*) AS month_sessions,
           COALESCE(SUM(gross_amount), 0) AS month_gross,
           COALESCE(SUM(net_payout),   0) AS month_payout,
           COALESCE(SUM(hours_worked), 0) AS session_hours
         FROM hostess_sessions
         WHERE hostess_id = $1
           AND TO_CHAR(start_at, 'YYYY-MM') = $2
           AND status = 'completed'`,
        [req.params.id, month]
      );
      const { rows: pendingRows } = await pool.query(
        `SELECT COALESCE(SUM(total_payout), 0) AS pending_payout
         FROM hostess_payouts WHERE hostess_id = $1 AND status = 'pending'`,
        [req.params.id]
      );
      res.json({
        data: {
          attendance: attnRows[0],
          sessions: sessRows[0],
          pending_payout: (pendingRows[0] as Record<string, unknown>).pending_payout,
          month,
        },
      });
    } catch (err) {
      console.error("accounts staff error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /accounts/agent/:id — Agent 수수료 요약
router.get(
  "/accounts/agent/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    try {
      const { rows } = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM staff WHERE agent_id = $1 AND is_active = true AND deleted_at IS NULL) AS hostess_count,
           COALESCE(SUM(commission_amount) FILTER (WHERE TO_CHAR(created_at,'YYYY-MM') = $2), 0) AS month_commission,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)                  AS pending_commission,
           COALESCE(SUM(commission_amount), 0)                                                    AS total_commission
         FROM agent_commissions WHERE agent_id = $1`,
        [req.params.id, month]
      );
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("accounts agent error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /accounts/daily?branch_id=&date=YYYY-MM-DD — 일일 매출 요약
router.get(
  "/accounts/daily",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const date      = (req.query.date as string)      || new Date().toISOString().split("T")[0];
    const branch_id = (req.query.branch_id as string) || null;
    try {
      const folioParams: unknown[] = [date];
      const folioFilter = branch_id ? ` AND fe.reservation_id IN (SELECT id FROM reservations WHERE branch_id = $2)` : "";
      if (branch_id) folioParams.push(branch_id);

      const { rows: revRows } = await pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'room_charge'),     0) AS room_revenue,
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'pos_item'),        0) AS pos_revenue,
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'hostess_charge'),  0) AS hostess_revenue,
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'outcall_fee'),     0) AS outcall_revenue,
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'late_charge'),     0) AS late_charge_revenue,
           COALESCE(SUM(amount) FILTER (WHERE entry_type NOT IN ('sst','discount','service_charge')), 0) AS total_revenue
         FROM folio_entries fe
         WHERE DATE(fe.posted_at) = $1 AND fe.is_void = false${folioFilter}`,
        folioParams
      );
      const payParams: unknown[] = [date];
      const payFilter = branch_id ? ` AND branch_id = $2` : "";
      if (branch_id) payParams.push(branch_id);

      const { rows: payRows } = await pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE method = 'cash'),                          0) AS cash_received,
           COALESCE(SUM(amount) FILTER (WHERE method IN ('card','credit_card','debit_card')), 0) AS card_received,
           COALESCE(SUM(amount) FILTER (WHERE method IN ('transfer','bank_transfer')),   0) AS transfer_received,
           COALESCE(SUM(amount), 0) AS total_received
         FROM payments
         WHERE DATE(paid_at) = $1 AND is_void = false${payFilter}`,
        payParams
      );
      res.json({ data: { date, revenue: revRows[0], payments: payRows[0] } });
    } catch (err) {
      console.error("accounts daily error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /hostess-sessions/reservation/:reservationId
router.get(
  "/hostess-sessions/reservation/:reservationId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT hs.*, s.full_name AS hostess_name, a.name AS agent_name
         FROM hostess_sessions hs
         JOIN staff s ON hs.hostess_id = s.id
         LEFT JOIN agents a ON hs.agent_id = a.id
         WHERE hs.reservation_id = $1
         ORDER BY hs.start_at`,
        [req.params.reservationId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("hostess sessions error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /hostess-sessions/staff/:staffId
router.get(
  "/hostess-sessions/staff/:staffId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    try {
      const { rows } = await pool.query(
        `SELECT hs.*, r.reservation_no
         FROM hostess_sessions hs
         JOIN reservations r ON hs.reservation_id = r.id
         WHERE hs.hostess_id = $1
           AND TO_CHAR(hs.start_at, 'YYYY-MM') = $2
         ORDER BY hs.start_at DESC`,
        [req.params.staffId, month]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("hostess sessions staff error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /hostess-payouts/staff/:staffId
router.get(
  "/hostess-payouts/staff/:staffId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT hp.*, s.full_name AS paid_by_name
         FROM hostess_payouts hp
         LEFT JOIN staff s ON hp.paid_by = s.id
         WHERE hp.hostess_id = $1
         ORDER BY hp.created_at DESC`,
        [req.params.staffId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("hostess payouts error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /agent-commissions/agent/:agentId
router.get(
  "/agent-commissions/agent/:agentId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT ac.*, s.full_name AS hostess_name
         FROM agent_commissions ac
         LEFT JOIN staff s ON ac.hostess_id = s.id
         WHERE ac.agent_id = $1
         ORDER BY ac.created_at DESC`,
        [req.params.agentId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("agent commissions error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /accounts/customer/:customerId — 고객 계정 요약
router.get(
  "/accounts/customer/:customerId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT
           COUNT(DISTINCT r.id)                                                    AS total_visits,
           COALESCE(SUM(i.total_amount), 0)                                        AS total_spent,
           COALESCE(AVG(i.total_amount), 0)                                        AS avg_session,
           COALESCE(SUM(CASE WHEN i.status != 'paid' AND i.status != 'void'
             THEN i.balance_due ELSE 0 END), 0)                                    AS outstanding
         FROM reservations r
         LEFT JOIN invoices i ON r.id = i.reservation_id
         WHERE r.customer_id = $1`,
        [req.params.customerId]
      );
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("accounts customer error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /invoices/customer/:customerId — 고객별 인보이스 목록
router.get(
  "/invoices/customer/:customerId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT i.*, r.reservation_no
         FROM invoices i
         LEFT JOIN reservations r ON i.reservation_id = r.id
         WHERE i.customer_id = $1
         ORDER BY i.created_at DESC`,
        [req.params.customerId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("invoices by customer error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;

