import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { authenticate, type JwtPayload } from "../middleware/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "MISSING_FIELDS", message: "Email and password are required" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, full_name AS name, email, password_hash, role, branch_id, 'staff' AS user_type
       FROM staff WHERE email = $1 AND is_active = true AND deleted_at IS NULL
       UNION ALL
       SELECT id, full_name AS name, email, password_hash, 'customer' AS role, NULL::uuid, 'customer'
       FROM customers WHERE email = $1 AND is_active = true AND deleted_at IS NULL
       UNION ALL
       SELECT id, name, email, password_hash, 'shareholder' AS role, NULL::uuid, 'shareholder'
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

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, branchId: user.branch_id, userType: user.user_type },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRY || "24h" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "30d" }
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
      { expiresIn: process.env.JWT_EXPIRY || "24h" }
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

export default router;
