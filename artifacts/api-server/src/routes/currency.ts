import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { getFxRates, refreshFxRates, convertAmount } from "../services/currency-service";

const router: IRouter = Router();

router.get("/fx-rates", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rates = await getFxRates();
    res.json({ data: rates });
  } catch (err) {
    console.error("[currency] GET /api/fx-rates error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/fx-rates/convert", async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, to } = req.body as { amount: number; from?: string; to: string };
    if (!amount || !to) {
      res.status(400).json({ error: "MISSING_FIELDS" }); return;
    }
    const result = await convertAmount(Number(amount), to);
    res.json({ data: { amountMyr: Number(amount), to, ...result } });
  } catch (err) {
    console.error("[currency] POST /api/fx-rates/convert error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post(
  "/fx-rates/refresh",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await refreshFxRates();
      const rates = await getFxRates();
      res.json({ data: rates, message: "FX rates refreshed" });
    } catch (err) {
      console.error("[currency] POST /api/fx-rates/refresh error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
