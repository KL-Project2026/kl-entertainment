import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";

const router: IRouter = Router();

// GET /folio/:reservationId — Folio 항목 조회
router.get(
  "/folio/:reservationId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT fe.*, s.full_name AS posted_by_name
         FROM folio_entries fe
         LEFT JOIN staff s ON fe.posted_by = s.id
         WHERE fe.reservation_id = $1 AND fe.is_void = false
         ORDER BY fe.posted_at ASC`,
        [req.params.reservationId]
      );
      const total = rows.reduce((sum, e) => sum + parseFloat(String((e as Record<string, unknown>).amount ?? 0)), 0);
      res.json({ data: { entries: rows, total: total.toFixed(4) } });
    } catch (err) {
      console.error("folio list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /folio/entries — Folio 항목 추가
router.post(
  "/folio/entries",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const {
      reservation_id, entry_type, description, quantity,
      unit_price, amount, currency, hostess_session_id, notes,
    } = req.body as Record<string, unknown>;
    try {
      const { rows } = await pool.query(
        `INSERT INTO folio_entries
           (reservation_id, entry_type, description, quantity,
            unit_price, amount, currency, hostess_session_id, posted_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          reservation_id, entry_type, description ?? null,
          quantity ?? 1, unit_price, amount, currency ?? "MYR",
          hostess_session_id ?? null, req.user!.id, notes ?? null,
        ]
      );
      res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("folio entry error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /folio/entries/:id — Folio 항목 취소 (void)
router.delete(
  "/folio/entries/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE folio_entries SET is_void = true, voided_at = NOW(), voided_by = $1
         WHERE id = $2 AND is_void = false RETURNING *`,
        [req.user!.id, req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("folio void error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /invoices — 인보이스 목록
router.get(
  "/invoices",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { branch_id, status, reservation_id } = req.query as Record<string, string>;
    try {
      const conditions: string[] = ["1=1"];
      const params: unknown[] = [];
      if (branch_id)      { params.push(branch_id);      conditions.push(`i.branch_id = $${params.length}`); }
      if (status)         { params.push(status);          conditions.push(`i.status = $${params.length}`); }
      if (reservation_id) { params.push(reservation_id); conditions.push(`i.reservation_id = $${params.length}`); }

      const { rows } = await pool.query(
        `SELECT i.*, r.reservation_no
         FROM invoices i
         LEFT JOIN reservations r ON i.reservation_id = r.id
         WHERE ${conditions.join(" AND ")}
         ORDER BY i.created_at DESC LIMIT 200`,
        params
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("invoices list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /invoices/reservation/:reservationId — 예약별 인보이스
router.get(
  "/invoices/reservation/:reservationId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT i.* FROM invoices i WHERE i.reservation_id = $1 ORDER BY i.created_at DESC`,
        [req.params.reservationId]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("invoices by reservation error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /invoices/:id — 인보이스 상세 (folio entries + payments 포함)
router.get(
  "/invoices/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows: invRows } = await pool.query(
        `SELECT i.*, r.reservation_no, b.name AS branch_name
         FROM invoices i
         LEFT JOIN reservations r ON i.reservation_id = r.id
         LEFT JOIN branches b ON i.branch_id = b.id
         WHERE i.id = $1`,
        [req.params.id]
      );
      if (!invRows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const invoice = invRows[0] as Record<string, unknown>;

      const { rows: entries } = await pool.query(
        `SELECT * FROM folio_entries WHERE reservation_id = $1 AND is_void = false ORDER BY posted_at`,
        [invoice.reservation_id]
      );
      const { rows: payments } = await pool.query(
        `SELECT * FROM payments WHERE invoice_id = $1 AND is_void = false ORDER BY paid_at`,
        [req.params.id]
      );
      res.json({ data: { invoice, entries, payments } });
    } catch (err) {
      console.error("invoice detail error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /invoices — Folio → Invoice 생성
router.post(
  "/invoices",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { reservation_id, notes } = req.body as Record<string, string>;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // get reservation + branch
      const { rows: resvRows } = await client.query(
        `SELECT r.*, b.internal_code FROM reservations r
         JOIN branches b ON b.id = r.branch_id WHERE r.id = $1`,
        [reservation_id]
      );
      if (!resvRows.length) throw new Error("예약을 찾을 수 없습니다.");
      const resv = resvRows[0] as Record<string, unknown>;

      // check existing
      const { rows: existing } = await client.query(
        `SELECT id FROM invoices WHERE reservation_id = $1 AND status != 'void'`,
        [reservation_id]
      );
      if (existing.length > 0) throw new Error("이미 인보이스가 생성되어 있습니다.");

      // sum folio entries
      const { rows: entries } = await client.query(
        `SELECT entry_type, SUM(amount) AS total FROM folio_entries
         WHERE reservation_id = $1 AND is_void = false
         GROUP BY entry_type`,
        [reservation_id]
      );
      let subtotal = 0, sst = 0, discount = 0, serviceCharge = 0;
      for (const e of entries) {
        const t = e as Record<string, unknown>;
        const amt = parseFloat(String(t.total ?? 0));
        if (t.entry_type === "sst")              sst += amt;
        else if (t.entry_type === "discount")    discount += amt;
        else if (t.entry_type === "service_charge") serviceCharge += amt;
        else                                     subtotal += amt;
      }
      const total = subtotal + sst + serviceCharge - discount;

      // generate invoice number
      const { rows: noRows } = await client.query(
        `SELECT generate_invoice_no($1) AS no`,
        [String(resv.internal_code ?? "KL01")]
      );
      const invoiceNo = (noRows[0] as Record<string, unknown>).no as string;

      const { rows: invRows } = await client.query(
        `INSERT INTO invoices
           (invoice_no, reservation_id, branch_id, customer_id, customer_name,
            subtotal, sst_amount, service_charge, discount_amount, total_amount,
            balance_due, currency, status, issued_at, issued_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MYR','issued',NOW(),$12,$13)
         RETURNING *`,
        [
          invoiceNo, reservation_id, resv.branch_id, resv.customer_id ?? null,
          resv.customer_name ?? null, subtotal, sst, serviceCharge, discount, total, total,
          req.user!.id, notes ?? null,
        ]
      );
      await client.query("COMMIT");
      res.status(201).json({ success: true, data: invRows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("invoice create error:", err);
      res.status(400).json({ error: (err as Error).message });
    } finally {
      client.release();
    }
  }
);

export default router;
