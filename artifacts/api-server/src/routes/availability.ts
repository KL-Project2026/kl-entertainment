import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";

const router: IRouter = Router();

// GET /availability/rooms?branch_id=&date=YYYY-MM-DD&start_dt=&end_dt=
router.get(
  "/availability/rooms",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { branch_id, date, start_dt, end_dt } = req.query as Record<string, string>;
    const startDt = start_dt ?? (date ? `${date}T00:00:00Z` : null);
    const endDt   = end_dt   ?? (date ? `${date}T23:59:59Z` : null);
    try {
      const conditions: string[] = ["r.is_active = true", "r.deleted_at IS NULL"];
      const params: unknown[] = [];
      if (branch_id) { params.push(branch_id); conditions.push(`r.branch_id = $${params.length}`); }
      if (startDt)   { params.push(startDt);   params.push(endDt); }

      const availabilityExpr = startDt
        ? `NOT EXISTS (
             SELECT 1 FROM availability_blocks ab
             WHERE ab.entity_type = 'room'
               AND ab.entity_id = r.id
               AND ab.is_active = true
               AND ab.start_dt < $${params.length}::timestamptz
               AND ab.end_dt   > $${params.length - 1}::timestamptz
           )`
        : "true";

      const { rows } = await pool.query(
        `SELECT r.*, ${availabilityExpr} AS is_available
         FROM rooms r
         WHERE ${conditions.join(" AND ")}
         ORDER BY r.sort_order, r.name`,
        params
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("availability rooms error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /availability/blocks?branch_id=&entity_id=&date=YYYY-MM-DD
router.get(
  "/availability/blocks",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { branch_id, entity_id, entity_type, date } = req.query as Record<string, string>;
    try {
      const conditions: string[] = ["ab.is_active = true"];
      const params: unknown[] = [];
      if (branch_id)   { params.push(branch_id);   conditions.push(`ab.branch_id = $${params.length}`); }
      if (entity_type) { params.push(entity_type); conditions.push(`ab.entity_type = $${params.length}`); }
      if (entity_id)   { params.push(entity_id);   conditions.push(`ab.entity_id = $${params.length}`); }
      if (date)        { params.push(date);         conditions.push(`DATE(ab.start_dt) <= $${params.length}::date AND DATE(ab.end_dt) >= $${params.length}::date`); }

      const { rows } = await pool.query(
        `SELECT ab.*, r.reservation_no, rm.name AS room_name
         FROM availability_blocks ab
         LEFT JOIN reservations r ON ab.reservation_id = r.id
         LEFT JOIN rooms rm ON ab.entity_id = rm.id
         WHERE ${conditions.join(" AND ")}
         ORDER BY ab.start_dt`,
        params
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("availability blocks error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /availability/check — 더블부킹 사전 체크
router.post(
  "/availability/check",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { entity_type, entity_id, start_dt, end_dt, exclude_reservation_id } = req.body as Record<string, string>;
    try {
      const params: unknown[] = [entity_type, entity_id, start_dt, end_dt];
      let q = `
        SELECT id, block_type, start_dt, end_dt
        FROM availability_blocks
        WHERE entity_type = $1
          AND entity_id   = $2
          AND is_active   = true
          AND start_dt < $4::timestamptz
          AND end_dt   > $3::timestamptz
      `;
      if (exclude_reservation_id) {
        params.push(exclude_reservation_id);
        q += ` AND (reservation_id IS NULL OR reservation_id != $${params.length})`;
      }
      const { rows } = await pool.query(q, params);
      res.json({
        available: rows.length === 0,
        conflicts: rows,
        message: rows.length > 0 ? "해당 시간에 이미 예약/차단이 있습니다." : null,
      });
    } catch (err) {
      console.error("availability check error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /availability/blocks — 수동 차단 추가
router.post(
  "/availability/blocks",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { entity_type, entity_id, branch_id, block_type, start_dt, end_dt, notes } = req.body as Record<string, string>;
    try {
      // conflict check
      const conflict = await pool.query(
        `SELECT id FROM availability_blocks
         WHERE entity_type = $1 AND entity_id = $2 AND is_active = true
           AND start_dt < $4::timestamptz AND end_dt > $3::timestamptz`,
        [entity_type, entity_id, start_dt, end_dt]
      );
      if (conflict.rows.length > 0) {
        res.status(409).json({ error: "해당 시간에 이미 다른 일정이 있습니다." });
        return;
      }
      const { rows } = await pool.query(
        `INSERT INTO availability_blocks
           (branch_id, entity_type, entity_id, block_type, start_dt, end_dt, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [branch_id ?? null, entity_type, entity_id, block_type, start_dt, end_dt, notes ?? null, req.user!.id]
      );
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("availability block create error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /availability/blocks/:id — 차단 해제
router.delete(
  "/availability/blocks/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query(
        `UPDATE availability_blocks SET is_active = false WHERE id = $1`,
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("availability block delete error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PUT /reservations/:id/assign-room — 체크인 시 룸 배정 (트랜잭션)
router.put(
  "/reservations/:id/assign-room",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { room_id } = req.body as { room_id: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: resvRows } = await client.query(
        `SELECT * FROM reservations WHERE id = $1`,
        [req.params.id]
      );
      if (!resvRows.length) throw new Error("예약을 찾을 수 없습니다.");
      const resv = resvRows[0] as Record<string, unknown>;

      // conflict check
      const { rows: conflicts } = await client.query(
        `SELECT id FROM availability_blocks
         WHERE entity_type = 'room' AND entity_id = $1 AND is_active = true
           AND start_dt < $3::timestamptz AND end_dt > $2::timestamptz
           AND (reservation_id IS NULL OR reservation_id != $4)`,
        [room_id, resv.start_time, resv.end_time ?? resv.start_time, req.params.id]
      );
      if (conflicts.length > 0) throw new Error("해당 룸은 선택 시간에 이미 예약되어 있습니다.");

      // update reservation
      await client.query(
        `UPDATE reservations SET room_id = $1, assigned_at = NOW(), assigned_by = $2 WHERE id = $3`,
        [room_id, req.user!.id, req.params.id]
      );

      // upsert availability block
      await client.query(
        `INSERT INTO availability_blocks
           (branch_id, entity_type, entity_id, block_type, reservation_id, start_dt, end_dt, created_by)
         SELECT branch_id, 'room', $1, 'booked', $2, start_time, COALESCE(end_time, start_time + INTERVAL '2 hours'), $3
         FROM reservations WHERE id = $2
         ON CONFLICT DO NOTHING`,
        [room_id, req.params.id, req.user!.id]
      );

      await client.query("COMMIT");
      res.json({ success: true, message: "룸이 배정되었습니다." });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("assign-room error:", err);
      res.status(400).json({ error: (err as Error).message });
    } finally {
      client.release();
    }
  }
);

export default router;
