import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router: IRouter = Router();

// ─── All authenticated roles can access their own profile ────────────────────
const allRoles = requireRole(
  "super_admin", "admin", "branch_manager", "manager",
  "hostess", "driver", "kitchen", "hall", "general", "investor",
);

// ─── Helper: mask sensitive string ───────────────────────────────────────────
function mask(value: string | null | undefined, show = 4): string {
  if (!value) return "";
  if (value.length <= show) return "*".repeat(value.length);
  return "*".repeat(value.length - show) + value.slice(-show);
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return mask(email);
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

// ─── GET /api/profile/me ─────────────────────────────────────────────────────
router.get(
  "/profile/me",
  authenticate,
  allRoles,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const role   = req.user!.role;

    try {
      // ── Base staff row ──────────────────────────────────────────────────────
      const { rows: staffRows } = await pool.query<Record<string, unknown>>(
        `SELECT
           s.id,
           s.full_name,
           s.employee_code,
           s.email,
           s.phone,
           s.role,
           s.employment_type,
           s.hire_date,
           s.contract_start,
           s.contract_end,
           s.is_active,
           s.profile_photo,
           s.language_pref,
           s.last_login_at,
           s.created_at,
           s.bank_account,
           s.bank_name,
           s.nationality,
           b.name  AS branch_name,
           b.id    AS branch_id,
           b.internal_code AS branch_code,
           b.address AS branch_address,
           b.operating_hours AS branch_operating_hours
         FROM staff s
         LEFT JOIN branches b ON b.id = s.branch_id
         WHERE s.id = $1 AND s.deleted_at IS NULL`,
        [userId],
      );

      if (!staffRows.length) {
        res.status(404).json({ error: "PROFILE_NOT_FOUND" });
        return;
      }

      const staff = staffRows[0];

      // ── Build base profile (masked sensitive fields) ────────────────────────
      const base: Record<string, unknown> = {
        id:               staff.id,
        full_name:        staff.full_name,
        employee_code:    staff.employee_code,
        role:             staff.role,
        employment_type:  staff.employment_type,
        hire_date:        staff.hire_date,
        contract_start:   staff.contract_start,
        contract_end:     staff.contract_end,
        is_active:        staff.is_active,
        profile_photo:    staff.profile_photo,
        language_pref:    staff.language_pref ?? "en",
        last_login_at:    staff.last_login_at,
        created_at:       staff.created_at,
        branch_id:        staff.branch_id,
        branch_name:      staff.branch_name,
        branch_code:      staff.branch_code,
        branch_address:   staff.branch_address,
        branch_operating_hours: staff.branch_operating_hours,
        // Masked
        phone_masked:     mask(staff.phone as string | null, 4),
        email_masked:     maskEmail(staff.email as string | null),
        bank_last4:       staff.bank_account ? (staff.bank_account as string).slice(-4) : null,
        bank_name:        staff.bank_name,
      };

      // ── Attendance summary (last 30 days) — all roles ──────────────────────
      const { rows: attRows } = await pool.query<Record<string, unknown>>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'present')   AS days_present,
           COUNT(*) FILTER (WHERE status = 'late')      AS days_late,
           COUNT(*) FILTER (WHERE status = 'absent')    AS days_absent,
           COALESCE(SUM(hours_worked), 0)               AS total_hours,
           COALESCE(SUM(CASE WHEN hours_worked > 9 THEN hours_worked - 9 ELSE 0 END), 0) AS ot_hours
         FROM attendance
         WHERE staff_id = $1
           AND work_date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId],
      );
      base.attendance_summary = attRows[0] ?? {};

      // ── Role-specific data ──────────────────────────────────────────────────

      if (role === "hostess") {
        const { rows: hpRows } = await pool.query<Record<string, unknown>>(
          `SELECT
             hp.id            AS hostess_profile_id,
             hp.status        AS availability_status,
             hp.languages_spoken,
             hp.agency_id,
             hp.available_today,
             hp.intro_text,
             a.name           AS agency_name,
             a.contact_person AS agency_contact,
             a.phone          AS agency_phone,
             a.email          AS agency_email,
             -- Performance
             (SELECT COUNT(*) FROM hostess_sessions hs WHERE hs.hostess_id = hp.id)
               AS total_sessions,
             (SELECT COALESCE(SUM(hs.hours_worked),0)
              FROM hostess_sessions hs
              WHERE hs.hostess_id = hp.id
                AND hs.created_at >= NOW() - INTERVAL '30 days')
               AS hours_30d
           FROM hostess_profiles hp
           LEFT JOIN agents a ON a.id = hp.agency_id
           WHERE hp.staff_id = $1 AND hp.deleted_at IS NULL
           LIMIT 1`,
          [userId],
        );
        base.hostess_profile = hpRows[0] ?? null;
      }

      if (role === "driver") {
        const { rows: drRows } = await pool.query<Record<string, unknown>>(
          `SELECT
             id_number     AS license_number_masked,
             id_expiry     AS license_expiry,
             nationality
           FROM staff
           WHERE id = $1`,
          [userId],
        );
        const dr = drRows[0] ?? {};
        const licenseExpiry = dr.license_expiry as string | null;
        let expiryWarning: "none" | "warn" | "critical" = "none";
        if (licenseExpiry) {
          const daysLeft = Math.floor(
            (new Date(licenseExpiry).getTime() - Date.now()) / 86400000,
          );
          if (daysLeft < 30)       expiryWarning = "critical";
          else if (daysLeft < 60)  expiryWarning = "warn";
        }
        base.driver_info = {
          license_masked: dr.license_number_masked
            ? mask(dr.license_number_masked as string, 2)
            : null,
          license_expiry:  licenseExpiry,
          expiry_warning:  expiryWarning,
        };

        // Trip stats
        const { rows: tripRows } = await pool.query<Record<string, unknown>>(
          `SELECT COUNT(*) AS total_trips
           FROM reservation_pickups
           WHERE driver_id = $1 AND status = 'completed'`,
          [userId],
        );
        base.driver_info = { ...base.driver_info as object, ...(tripRows[0] ?? {}) };
      }

      if (role === "kitchen") {
        const { rows: kitRows } = await pool.query<Record<string, unknown>>(
          `SELECT
             COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS orders_today,
             COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW())) AS orders_this_week
           FROM orders
           WHERE branch_id = $1 AND status = 'completed'`,
          [req.user!.branchId ?? "00000000-0000-0000-0000-000000000000"],
        );
        base.kitchen_info = kitRows[0] ?? {};
      }

      if (role === "general") {
        // Leave balance from payslips deductions or just attendance
        const { rows: schedRows } = await pool.query<Record<string, unknown>>(
          `SELECT COUNT(*) AS upcoming_shifts
           FROM staff_schedules
           WHERE staff_id = $1 AND shift_date >= CURRENT_DATE AND shift_date <= CURRENT_DATE + 14`,
          [userId],
        );
        base.general_info = {
          upcoming_shifts: schedRows[0]?.upcoming_shifts ?? 0,
          department: (staff.notes as string | null) ?? null,
        };
      }

      res.json({ success: true, profile: base });
    } catch (err) {
      console.error("[profile] GET /profile/me failed:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: String(err) });
    }
  },
);

// ─── PATCH /api/profile/me ───────────────────────────────────────────────────
// Allowed updates: full_name, language_pref, profile_photo
// Hostess extra: availability_status (in hostess_profiles.status)
router.patch(
  "/profile/me",
  authenticate,
  allRoles,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const role   = req.user!.role;
    const body   = req.body as Record<string, unknown>;

    try {
      const updates: string[]  = [];
      const params: unknown[]  = [];

      if (typeof body.full_name === "string" && body.full_name.trim()) {
        params.push(body.full_name.trim());
        updates.push(`full_name = $${params.length}`);
      }
      if (typeof body.language_pref === "string") {
        const allowed = ["en", "zh", "ms", "th", "ko", "ja"];
        if (allowed.includes(body.language_pref)) {
          params.push(body.language_pref);
          updates.push(`language_pref = $${params.length}`);
        }
      }
      if (typeof body.profile_photo === "string") {
        params.push(body.profile_photo || null);
        updates.push(`profile_photo = $${params.length}`);
      }

      if (updates.length === 0 && !(role === "hostess" && body.availability_status)) {
        res.status(400).json({ error: "NOTHING_TO_UPDATE" });
        return;
      }

      if (updates.length > 0) {
        params.push(userId);
        await pool.query(
          `UPDATE staff SET ${updates.join(", ")} WHERE id = $${params.length}`,
          params,
        );
      }

      // Hostess: update availability status in hostess_profiles
      if (role === "hostess" && typeof body.availability_status === "string") {
        const validStatuses = ["available", "unavailable", "on_leave", "blackout"];
        if (validStatuses.includes(body.availability_status)) {
          await pool.query(
            `UPDATE hostess_profiles SET status = $1, available_today = ($1 = 'available')
             WHERE staff_id = $2 AND deleted_at IS NULL`,
            [body.availability_status, userId],
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[profile] PATCH /profile/me failed:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: String(err) });
    }
  },
);

export default router;
