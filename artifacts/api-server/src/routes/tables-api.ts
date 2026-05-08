import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { blockInvestor } from "../middleware/rbac";

const router: IRouter = Router();

// GET /tables — list all tables (optionally filter by branch)
router.get(
  "/tables",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { branch_id } = req.query as Record<string, string>;
    try {
      let q = `
        SELECT t.*, b.name AS branch_name
        FROM tables t
        LEFT JOIN branches b ON b.id = t.branch_id
        WHERE t.org_id = $1
      `;
      const params: unknown[] = ["00000000-0000-0000-0000-000000000001"];
      if (branch_id) {
        params.push(branch_id);
        q += ` AND t.branch_id = $${params.length}`;
      }
      q += " ORDER BY t.name";
      const { rows } = await pool.query(q, params);
      res.json({ data: rows });
    } catch (err) {
      console.error("tables list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /tables/:id — single table detail
router.get(
  "/tables/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT t.*, b.name AS branch_name
         FROM tables t
         LEFT JOIN branches b ON b.id = t.branch_id
         WHERE t.id = $1`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "TABLE_NOT_FOUND" });
        return;
      }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("table detail error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PUT /tables/:id/status — update table status
router.put(
  "/tables/:id/status",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body as { status: string };
    const valid = ["available", "occupied", "reserved", "maintenance"];
    if (!valid.includes(status)) {
      res.status(400).json({ error: "INVALID_STATUS" });
      return;
    }
    try {
      const { rows } = await pool.query(
        `UPDATE tables SET status = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "TABLE_NOT_FOUND" });
        return;
      }
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("table status update error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
