import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { generateReceiptHtml } from "../services/document-service";

const router: IRouter = Router();

// Get receipt HTML — supports Bearer token in header OR ?token= query param (for print popups)
router.get(
  "/receipts/:id",
  (req: Request, res: Response, next: import("express").NextFunction): void => {
    const queryToken = (req.query as Record<string, string>).token;
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }
    authenticate(req, res, next);
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { mode = "detailed" } = req.query as Record<string, string>;
      const html = await generateReceiptHtml(req.params.id, mode as "detailed" | "basic");
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === "RECEIPT_NOT_FOUND") res.status(404).json({ error: "NOT_FOUND" });
      else { console.error(err); res.status(500).json({ error: "INTERNAL_ERROR" }); }
    }
  }
);

// Record print event
router.post(
  "/receipts/:id/printed",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE receipts SET print_count = COALESCE(print_count, 0) + 1, printed_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      res.json({ success: true, printCount: (rows[0] as Record<string, unknown>).print_count });
    } catch (err) {
      console.error("Print record error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
