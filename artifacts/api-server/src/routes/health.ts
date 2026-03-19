import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json({ ...data, db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() });
  }
});

export default router;
