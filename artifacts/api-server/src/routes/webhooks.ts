import { Router, type IRouter, type Request, type Response } from "express";
import { handleTelegramUpdate } from "../services/telegram-service";

const router: IRouter = Router();

router.get("/webhooks/whatsapp", (req: Request, res: Response): void => {
  const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "kl_whatsapp_verify";
  const mode = (req.query as Record<string, string>)["hub.mode"];
  const token = (req.query as Record<string, string>)["hub.verify_token"];
  const challenge = (req.query as Record<string, string>)["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[whatsapp] Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "FORBIDDEN" });
  }
});

router.post("/webhooks/whatsapp", async (req: Request, res: Response): Promise<void> => {
  console.log("[whatsapp] Inbound webhook:", JSON.stringify(req.body).slice(0, 300));
  res.status(200).json({ status: "ok" });
});

router.post("/webhooks/telegram", async (req: Request, res: Response): Promise<void> => {
  try {
    await handleTelegramUpdate(req.body as Record<string, unknown>);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[telegram] Webhook error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
