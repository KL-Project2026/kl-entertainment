import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "changeme";
const ORG_ID = process.env["DEFAULT_ORG_ID"] ?? "00000000-0000-0000-0000-000000000001";

function customerToken(customerId: string): string {
  return jwt.sign({ sub: customerId, type: "customer" }, JWT_SECRET, { expiresIn: "7d" });
}

export function authenticateCustomer(req: Request, res: Response, next: () => void): void {
  const header = req.headers["authorization"] ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; type: string };
    if (payload.type !== "customer") { res.status(403).json({ error: "FORBIDDEN" }); return; }
    (req as Request & { customerId: string }).customerId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

router.post("/customer/auth/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, password, languagePref = "en" } = req.body as {
      fullName: string; email: string; phone: string; password: string; languagePref?: string;
    };

    if (!fullName || !email || !phone || !password) {
      res.status(400).json({ error: "MISSING_FIELDS" }); return;
    }

    const existing = await pool.query(`SELECT id FROM customers WHERE email = $1`, [email]);
    if ((existing.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "EMAIL_TAKEN" }); return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const code = `C${Date.now().toString(36).toUpperCase()}`;

    const { rows } = await pool.query<{ id: string; full_name: string; email: string }>(
      `INSERT INTO customers (org_id, customer_code, full_name, phone, email, password_hash, language_pref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email`,
      [ORG_ID, code, fullName, phone, email, passwordHash, languagePref]
    );

    const customer = rows[0]!;
    res.status(201).json({ data: { ...customer, token: customerToken(customer.id) } });
  } catch (err) {
    console.error("[customer-auth] register error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/customer/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) { res.status(400).json({ error: "MISSING_FIELDS" }); return; }

    const { rows } = await pool.query<{
      id: string; full_name: string; email: string; password_hash: string;
      language_pref: string; vip_tier: string; credit_balance: string;
    }>(
      `SELECT id, full_name, email, password_hash, language_pref, vip_tier, credit_balance
       FROM customers WHERE email = $1 AND deleted_at IS NULL AND is_active = true`,
      [email]
    );

    const customer = rows[0];
    if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
      res.status(401).json({ error: "INVALID_CREDENTIALS" }); return;
    }

    res.json({
      data: {
        id: customer.id,
        fullName: customer.full_name,
        email: customer.email,
        languagePref: customer.language_pref,
        vipTier: customer.vip_tier,
        creditBalance: parseFloat(customer.credit_balance),
        token: customerToken(customer.id),
      },
    });
  } catch (err) {
    console.error("[customer-auth] login error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.get("/customer/profile", (req: Request, res: Response, next: () => void) => authenticateCustomer(req, res, next), async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { rows } = await pool.query<{
      id: string; full_name: string; email: string; phone: string;
      language_pref: string; vip_tier: string; credit_balance: string; nationality: string;
    }>(
      `SELECT id, full_name, email, phone, language_pref, vip_tier, credit_balance, nationality
       FROM customers WHERE id = $1`,
      [customerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("[customer-auth] profile error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.put("/customer/profile", (req: Request, res: Response, next: () => void) => authenticateCustomer(req, res, next), async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as Request & { customerId: string }).customerId;
    const { fullName, phone, languagePref, nationality } = req.body as {
      fullName?: string; phone?: string; languagePref?: string; nationality?: string;
    };

    const { rows } = await pool.query<{ id: string; full_name: string; email: string; language_pref: string }>(
      `UPDATE customers
       SET full_name    = COALESCE($1, full_name),
           phone        = COALESCE($2, phone),
           language_pref = COALESCE($3, language_pref),
           nationality  = COALESCE($4, nationality)
       WHERE id = $5
       RETURNING id, full_name, email, language_pref`,
      [fullName, phone, languagePref, nationality, customerId]
    );
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("[customer-auth] update profile error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
