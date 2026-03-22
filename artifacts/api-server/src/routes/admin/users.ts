// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY User Management API — Super Admin only
// Endpoints: GET/POST /api/admin/users, GET/PUT/DELETE /api/admin/users/:id
//            GET /api/admin/users/:id/ledger, PUT /api/admin/users/:id/password
//            GET /api/admin/users/branches — branch list for filter
// ─────────────────────────────────────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { authenticate } from "../../middleware/auth";
import { ROLES } from "../../config/constants";

const router = Router();

// Super-Admin exclusive guard — admin role also gets 403
function superAdminOnly(req: Request, res: Response, next: () => void): void {
  if (!req.user) { res.status(401).json({ success: false, error: "UNAUTHORIZED" }); return; }
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403).json({ success: false, error: "FORBIDDEN", required: "super_admin", current: req.user.role });
    return;
  }
  next();
}

async function writeAuditLog(
  entityType: string,
  entityId: string,
  action: string,
  changedBy: string,
  oldValues: object | null,
  newValues: object | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entityType, entityId, action, changedBy, JSON.stringify(oldValues), JSON.stringify(newValues)],
    );
  } catch (e) {
    console.error("[audit_log] write failed:", e instanceof Error ? e.message : e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/branches — Branch list for filter dropdown
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users/branches", authenticate, superAdminOnly, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, internal_code FROM branches WHERE deleted_at IS NULL ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET /admin/users/branches]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users — Full user list with ledger balance + plain_password
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, role, branch_id, is_active, limit = "20", offset = "0" } = req.query as Record<string, string | undefined>;

    const params: unknown[] = [];
    const where: string[] = ["s.deleted_at IS NULL"];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(s.full_name ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
    }
    if (role) { params.push(role); where.push(`s.role = $${params.length}`); }
    if (branch_id) { params.push(branch_id); where.push(`s.branch_id = $${params.length}`); }
    if (is_active !== undefined && is_active !== "") { params.push(is_active === "true"); where.push(`s.is_active = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM staff s ${whereClause}`,
      params,
    );
    const total = parseInt(countRows[0].total, 10);

    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const { rows } = await pool.query(
      `SELECT
         s.id, s.employee_code, s.full_name, s.email, s.phone, s.role,
         s.is_active, s.created_at, s.last_login_at, s.hire_date,
         s.plain_password,
         s.branch_id, b.name AS branch_name,
         o.id AS org_id, o.name AS org_name,
         hp.id AS hostess_profile_id, hp.agency_hostess_code AS hostess_code,
         la.balance_cache AS ledger_balance, la.currency AS ledger_currency
       FROM staff s
       LEFT JOIN branches b ON b.id = s.branch_id
       LEFT JOIN organizations o ON o.id = (
         SELECT org_id FROM branches WHERE id = s.branch_id LIMIT 1
       )
       LEFT JOIN hostess_profiles hp ON hp.staff_id = s.id
       LEFT JOIN ledger_accounts la ON la.entity_id = COALESCE(hp.id, s.id) AND la.is_active = true
       ${whereClause}
       ORDER BY s.full_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ success: true, data: rows, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    console.error("[GET /admin/users]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id — Single user detail
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users/:id", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT
         s.id, s.employee_code, s.full_name, s.legal_name, s.email, s.phone, s.whatsapp,
         s.role, s.employment_type, s.hire_date, s.is_active, s.created_at, s.last_login_at,
         s.bank_name, s.bank_account, s.notes, s.plain_password,
         s.branch_id, b.name AS branch_name,
         o.id AS org_id, o.name AS org_name,
         hp.id AS hostess_profile_id, hp.agency_hostess_code AS hostess_code,
         ag.name AS agent_name
       FROM staff s
       LEFT JOIN branches b ON b.id = s.branch_id
       LEFT JOIN organizations o ON o.id = (SELECT org_id FROM branches WHERE id = s.branch_id LIMIT 1)
       LEFT JOIN hostess_profiles hp ON hp.staff_id = s.id
       LEFT JOIN agents ag ON ag.id = s.agent_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) { res.status(404).json({ success: false, error: "USER_NOT_FOUND" }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[GET /admin/users/:id]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id/ledger — User ledger summary
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users/:id/ledger", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { rows: userRows } = await pool.query<{ role: string; hostess_profile_id: string | null }>(
      `SELECT s.role, hp.id AS hostess_profile_id
       FROM staff s
       LEFT JOIN hostess_profiles hp ON hp.staff_id = s.id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    if (!userRows.length) { res.status(404).json({ success: false, error: "USER_NOT_FOUND" }); return; }
    const user = userRows[0];

    if (user.role === ROLES.INVESTOR) {
      const { rows: orgRow } = await pool.query<{ org_id: string }>(
        `SELECT org_id FROM branches WHERE id = (SELECT branch_id FROM staff WHERE id = $1) LIMIT 1`, [id]
      );
      const orgId = orgRow[0]?.org_id ?? null;
      const { rows: summary } = await pool.query(
        `SELECT * FROM v_investor_summary WHERE org_id = $1 AND staff_id = $2`, [orgId, id]
      );
      res.json({ success: true, isInvestor: true, data: summary });
      return;
    }

    const accountTypeMap: Record<string, string> = {
      hostess: "hostess", driver: "driver", investor: "investor",
      branch_manager: "staff", manager: "staff", kitchen: "staff",
      hall: "staff", general: "staff", admin: "staff", super_admin: "staff",
    };
    const accountType = accountTypeMap[user.role] ?? "staff";
    const entityId = (user.role === ROLES.HOSTESS && user.hostess_profile_id) ? user.hostess_profile_id : id;

    const { rows: accRows } = await pool.query(
      `SELECT * FROM ledger_accounts WHERE entity_id = $1 AND account_type = $2 AND is_active = true LIMIT 1`,
      [entityId, accountType]
    );
    if (!accRows.length) {
      res.json({ success: true, noLedger: true, message: "No ledger account found for this user." });
      return;
    }
    const account = accRows[0];

    const { rows: entries } = await pool.query(
      `SELECT id, effective_date, entry_type, direction, amount, currency, description, source_type, status
       FROM ledger_entries
       WHERE account_id = $1
       ORDER BY effective_date DESC, created_at DESC
       LIMIT 10`,
      [account.id]
    );

    const { rows: monthlyRows } = await pool.query<{ income: string; deductions: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'CR' THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN direction = 'DR' THEN amount ELSE 0 END), 0) AS deductions
       FROM ledger_entries
       WHERE account_id = $1
         AND DATE_TRUNC('month', effective_date) = DATE_TRUNC('month', CURRENT_DATE)`,
      [account.id]
    );
    const monthly = monthlyRows[0];

    res.json({
      success: true,
      data: {
        account,
        recentEntries: entries,
        thisMonth: { income: parseFloat(monthly.income), deductions: parseFloat(monthly.deductions) },
      },
    });
  } catch (err) {
    console.error("[GET /admin/users/:id/ledger]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users — Create new user
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/users", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, email, role, password, phone, branch_id, employment_type } = req.body as Record<string, string>;

    if (!full_name || !email || !role || !password) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "full_name, email, role, and password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Password must be at least 8 characters." });
      return;
    }

    const { rows: existing } = await pool.query(`SELECT id FROM staff WHERE email = $1`, [email]);
    if (existing.length) {
      res.status(409).json({ success: false, error: "EMAIL_DUPLICATE", message: "This email is already in use." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows: newUser } = await pool.query(
      `INSERT INTO staff (full_name, email, password_hash, plain_password, role, phone, branch_id, employment_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, full_name, email, role, is_active, created_at, plain_password`,
      [full_name, email, passwordHash, password, role, phone ?? null, branch_id ?? null, employment_type ?? "full_time"],
    );
    const created = newUser[0];

    if (role === ROLES.HOSTESS) {
      await pool.query(
        `INSERT INTO hostess_profiles (staff_id, is_active) VALUES ($1, true) ON CONFLICT DO NOTHING`,
        [created.id]
      );
    }

    const accTypeMap: Record<string, string> = { hostess: "hostess", driver: "driver", investor: "investor" };
    const accountType = accTypeMap[role] ?? "staff";
    const { rows: orgRow } = await pool.query(
      `SELECT org_id FROM branches WHERE id = $1 LIMIT 1`, [branch_id ?? null]
    );
    if (orgRow.length) {
      await pool.query(
        `INSERT INTO ledger_accounts (org_id, account_type, entity_id, currency, is_active)
         VALUES ($1, $2, $3, 'MYR', true) ON CONFLICT DO NOTHING`,
        [orgRow[0].org_id, accountType, created.id]
      );
    }

    await writeAuditLog("staff", created.id, "user_created", req.user!.id, null, { full_name, email, role });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("[POST /admin/users]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/:id — Update user info
// ─────────────────────────────────────────────────────────────────────────────
router.put("/admin/users/:id", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, role, branch_id, is_active, employment_type, notes } = req.body as Record<string, unknown>;

    const { rows: curr } = await pool.query(
      `SELECT id, full_name, email, phone, role, branch_id, is_active FROM staff WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    if (!curr.length) { res.status(404).json({ success: false, error: "USER_NOT_FOUND" }); return; }

    const updates: string[] = [];
    const params: unknown[] = [];
    const append = (col: string, val: unknown) => { params.push(val); updates.push(`${col} = $${params.length}`); };

    if (full_name !== undefined) append("full_name", full_name);
    if (email     !== undefined) append("email", email);
    if (phone     !== undefined) append("phone", phone);
    if (role      !== undefined) append("role", role);
    if (branch_id !== undefined) append("branch_id", branch_id);
    if (is_active !== undefined) append("is_active", is_active);
    if (employment_type !== undefined) append("employment_type", employment_type);
    if (notes     !== undefined) append("notes", notes);

    if (!updates.length) { res.status(400).json({ success: false, error: "NO_CHANGES" }); return; }

    params.push(id);
    const { rows: updated } = await pool.query(
      `UPDATE staff SET ${updates.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id, full_name, email, phone, role, branch_id, is_active`,
      params,
    );

    await writeAuditLog("staff", id, "user_updated", req.user!.id, curr[0] as object, req.body as object);

    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error("[PUT /admin/users/:id]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/:id/password — Change password (stores plain_password)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/admin/users/:id/password", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { new_password, confirm_password } = req.body as Record<string, string>;

    if (!new_password || !confirm_password) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "new_password and confirm_password are required." });
      return;
    }
    if (new_password !== confirm_password) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Passwords do not match." });
      return;
    }
    if (new_password.length < 8) {
      res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "Password must be at least 8 characters." });
      return;
    }

    const { rows } = await pool.query(`SELECT id FROM staff WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!rows.length) { res.status(404).json({ success: false, error: "USER_NOT_FOUND" }); return; }

    const hash = await bcrypt.hash(new_password, 12);
    // Store both bcrypt hash (for auth) and plain text (for super admin visibility)
    await pool.query(
      `UPDATE staff SET password_hash = $1, plain_password = $2 WHERE id = $3`,
      [hash, new_password, id]
    );

    await writeAuditLog("staff", id, "password_changed", req.user!.id, null, { changed_by: req.user!.id, target_user: id });

    res.json({ success: true, message: "Password changed successfully. This action has been recorded in the audit log." });
  } catch (err) {
    console.error("[PUT /admin/users/:id/password]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id — Soft delete (is_active=false, deleted_at=NOW())
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/admin/users/:id", authenticate, superAdminOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: "SELF_DELETE", message: "You cannot deactivate your own account." });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, full_name FROM staff WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    if (!rows.length) { res.status(404).json({ success: false, error: "USER_NOT_FOUND" }); return; }

    await pool.query(
      `UPDATE staff SET is_active = false, deleted_at = NOW() WHERE id = $1`, [id]
    );

    await writeAuditLog("staff", id, "user_deactivated", req.user!.id, { id, full_name: (rows[0] as { full_name: string }).full_name }, { is_active: false });

    res.json({ success: true, message: "User has been deactivated." });
  } catch (err) {
    console.error("[DELETE /admin/users/:id]", err);
    res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});

export default router;
