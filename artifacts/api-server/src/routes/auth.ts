import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { authenticate, type JwtPayload } from "../middleware/auth";
import { sendEmail } from "../services/email";
import { passwordResetEmail } from "../services/email-templates";

const router: IRouter = Router();

const RESET_TOKEN_TTL_MINUTES = 60;

type UserScope = "staff" | "customers" | "shareholders";
type ResetUser = { id: string; name: string; email: string; scope: UserScope };

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function findUserByEmail(email: string): Promise<ResetUser | null> {
  const { rows } = await pool.query(
    `SELECT id, full_name AS name, email, 'staff' AS scope
       FROM staff WHERE email = $1 AND is_active = true AND deleted_at IS NULL
     UNION ALL
     SELECT id, full_name AS name, email, 'customers' AS scope
       FROM customers WHERE email = $1 AND is_active = true AND deleted_at IS NULL
     UNION ALL
     SELECT id, name, email, 'shareholders' AS scope
       FROM shareholders WHERE email = $1 AND is_active = true
     LIMIT 1`,
    [email]
  );
  return rows.length ? (rows[0] as ResetUser) : null;
}

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "MISSING_FIELDS", message: "Email and password are required" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, full_name AS name, email, password_hash, role, branch_id,
              COALESCE(investor_branch_scope, '[]'::jsonb) AS investor_branch_scope,
              'staff' AS user_type
       FROM staff WHERE email = $1 AND is_active = true AND deleted_at IS NULL
       UNION ALL
       SELECT id, full_name AS name, email, password_hash, 'customer' AS role, NULL::uuid,
              '[]'::jsonb, 'customer'
       FROM customers WHERE email = $1 AND is_active = true AND deleted_at IS NULL
       UNION ALL
       SELECT id, name, email, password_hash, 'shareholder' AS role, NULL::uuid,
              '[]'::jsonb, 'shareholder'
       FROM shareholders WHERE email = $1 AND is_active = true
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      res.status(401).json({ error: "INVALID_CREDENTIALS" });
      return;
    }

    const user = rows[0] as {
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      branch_id: string | null;
      investor_branch_scope: string[];
      user_type: string;
    };

    if (!user.password_hash) {
      res.status(401).json({ error: "INVALID_CREDENTIALS" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "INVALID_CREDENTIALS" });
      return;
    }

    // Update last_login_at (non-blocking)
    pool.query("UPDATE staff SET last_login_at = NOW() WHERE id = $1", [user.id]).catch(() => {});

    const investorBranchScope: string[] = Array.isArray(user.investor_branch_scope)
      ? (user.investor_branch_scope as string[])
      : [];

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        branchId: user.branch_id,
        userType: user.user_type,
        investorBranchScope,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRY || "24h") as string } as import("jsonwebtoken").SignOptions
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRY || "30d") as string } as import("jsonwebtoken").SignOptions
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branch_id,
        userType: user.user_type,
        investorBranchScope,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/auth/logout", authenticate, (_req: Request, res: Response): void => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
});

router.post("/auth/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({ error: "MISSING_TOKEN" });
      return;
    }

    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as JwtPayload & { id: string };

    const { rows } = await pool.query(
      `SELECT id, role, branch_id, 'staff' AS user_type FROM staff WHERE id = $1 AND is_active = true
       UNION ALL
       SELECT id, 'customer', NULL::uuid, 'customer' FROM customers WHERE id = $1 AND is_active = true
       UNION ALL
       SELECT id, 'shareholder', NULL::uuid, 'shareholder' FROM shareholders WHERE id = $1 AND is_active = true
       LIMIT 1`,
      [payload.id]
    );

    if (!rows.length) {
      res.status(401).json({ error: "USER_NOT_FOUND" });
      return;
    }

    const user = rows[0] as { id: string; role: string; branch_id: string | null; user_type: string };

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, branchId: user.branch_id, userType: user.user_type },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRY || "24h") as string } as import("jsonwebtoken").SignOptions
    );

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
  }
});

router.get("/auth/me", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name AS name, email, role, branch_id, 'staff' AS user_type FROM staff WHERE id = $1
       UNION ALL
       SELECT id, full_name, email, 'customer', NULL::uuid, 'customer' FROM customers WHERE id = $1
       UNION ALL
       SELECT id, name, email, 'shareholder', NULL::uuid, 'shareholder' FROM shareholders WHERE id = $1
       LIMIT 1`,
      [req.user!.id]
    );

    if (!rows.length) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    const user = rows[0] as { id: string; name: string; email: string; role: string; branch_id: string | null; user_type: string };

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
      userType: user.user_type,
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ─── Forgot Password ──────────────────────────────────────────
// POST /auth/forgot-password { email }
// Always returns 200 to avoid email enumeration. Sends reset email if user exists.
router.post("/auth/forgot-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "MISSING_EMAIL" });
      return;
    }

    const normalized = email.trim().toLowerCase();
    const user = await findUserByEmail(normalized);

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await pool.query(
        `UPDATE ${user.scope} SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3`,
        [tokenHash, expiresAt, user.id]
      );

      const appUrl = process.env.APP_PUBLIC_URL || "http://localhost:5173";
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      const tpl = passwordResetEmail({
        name: user.name || user.email,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      });

      const result = await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });

      if (!result.sent) {
        console.error("[forgot-password] email send failed for", user.email, result.error);
      }
    }

    // Always return success — do not reveal whether the email exists.
    res.json({ ok: true, message: "If an account exists for this email, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// POST /auth/reset-password { token, password }
router.post("/auth/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({ error: "MISSING_FIELDS" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "PASSWORD_TOO_SHORT", message: "Password must be at least 8 characters." });
      return;
    }

    const tokenHash = hashToken(token);
    const scopes: UserScope[] = ["staff", "customers", "shareholders"];

    for (const scope of scopes) {
      const { rows } = await pool.query(
        `SELECT id FROM ${scope}
          WHERE reset_token_hash = $1
            AND reset_token_expires_at IS NOT NULL
            AND reset_token_expires_at > NOW()
          LIMIT 1`,
        [tokenHash]
      );
      if (rows.length) {
        const userId = (rows[0] as { id: string }).id;
        const newHash = await bcrypt.hash(password, 12);
        await pool.query(
          `UPDATE ${scope}
              SET password_hash = $1,
                  reset_token_hash = NULL,
                  reset_token_expires_at = NULL
            WHERE id = $2`,
          [newHash, userId]
        );
        res.json({ ok: true });
        return;
      }
    }

    res.status(400).json({ error: "INVALID_OR_EXPIRED_TOKEN" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
