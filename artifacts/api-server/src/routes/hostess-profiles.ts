import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router: IRouter = Router();

// ─── Upload storage (local disk → /uploads/hostess-photos/) ──────
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "hostess-photos");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── RBAC helpers ────────────────────────────────────────────────
const MANAGER_UP = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER] as const;
const ADMIN_UP   = [ROLES.SUPER_ADMIN, ROLES.ADMIN] as const;

function isManagerUp(role: string) {
  return (MANAGER_UP as readonly string[]).includes(role);
}

// ─── Field serializer (RBAC masking) ─────────────────────────────
function serializeProfile(row: Record<string, unknown>, requestingRole: string) {
  const base = {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.full_name,
    staffCode: row.employee_code,
    branchId: row.branch_id,
    branchName: row.branch_name,
    allowedBranchIds: row.allowed_branch_ids ?? [],
    nationality: row.nationality,
    nationalityCode: row.nationality_code,
    languagesSpoken: row.languages_spoken ?? [],
    introText: row.intro_text,
    introTranslations: row.intro_translations ?? {},
    status: row.status,
    availableToday: row.available_today,
    displayOrder: row.display_order,
    isFeatured: row.is_featured,
    agencyId: row.agency_id,
    agentName: row.agent_name,
    agencyHostessCode: row.agency_hostess_code,
    agencyCommissionRate: row.agency_commission_rate ? parseFloat(row.agency_commission_rate as string) : null,
    agencyCommissionType: row.agency_commission_type ?? null,
    pdpaConsentGiven: row.pdpa_consent_given,
    pdpaConsentDate: row.pdpa_consent_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // computed
    age: row.age ? parseInt(row.age as string) : null,
    primaryPhoto: row.primary_photo,
    photoCount: row.photo_count ? parseInt(row.photo_count as string) : 0,
    serviceCount: row.service_count ? parseInt(row.service_count as string) : 0,
    minServicePrice: row.min_service_price ? parseFloat(row.min_service_price as string) : null,
  };

  if (isManagerUp(requestingRole)) {
    return {
      ...base,
      dateOfBirth: row.date_of_birth,
      heightCm: row.height_cm,
      weightKg: row.weight_kg ? parseFloat(row.weight_kg as string) : null,
      bodySize: row.body_size,
      bustCm: row.bust_cm,
      waistCm: row.waist_cm,
      hipCm: row.hip_cm,
    };
  }
  return base;
}

// ─── GET /hostess-profiles — List ────────────────────────────────
router.get("/hostess-profiles", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as { user: { role: string } }).user;
    const { branch_id, status, available_today, nationality_code, search } = req.query as Record<string, string>;

    const conds: string[] = ["hp.deleted_at IS NULL"];
    const params: unknown[] = [];
    let p = 1;

    if (branch_id) { conds.push(`hp.branch_id = $${p++}`); params.push(branch_id); }
    if (status)    { conds.push(`hp.status = $${p++}`);    params.push(status); }
    if (nationality_code) { conds.push(`hp.nationality_code = $${p++}`); params.push(nationality_code.toUpperCase()); }
    if (available_today === "true") { conds.push(`hp.available_today = true`); }
    if (search) {
      conds.push(`(s.full_name ILIKE $${p++} OR s.employee_code ILIKE $${p - 1})`);
      params.push(`%${search}%`);
    }

    const { rows } = await pool.query(
      `SELECT hp.*,
              s.full_name, s.employee_code,
              b.name AS branch_name,
              a.name AS agent_name,
              a.commission_rate AS agency_commission_rate,
              a.commission_type AS agency_commission_type,
              EXTRACT(YEAR FROM AGE(NOW(), hp.date_of_birth)) AS age,
              (SELECT storage_key FROM hostess_photos ph
               WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true
                 AND ph.is_approved = true AND ph.deleted_at IS NULL LIMIT 1) AS primary_photo,
              (SELECT COUNT(*) FROM hostess_photos ph
               WHERE ph.hostess_profile_id = hp.id AND ph.is_approved = true AND ph.deleted_at IS NULL) AS photo_count,
              (SELECT COUNT(*) FROM hostess_services hs
               WHERE hs.hostess_profile_id = hp.id AND hs.is_active = true) AS service_count,
              (SELECT MIN(price_amount) FROM hostess_services hs
               WHERE hs.hostess_profile_id = hp.id AND hs.is_active = true) AS min_service_price
       FROM hostess_profiles hp
       JOIN staff s ON s.id = hp.staff_id
       JOIN branches b ON b.id = hp.branch_id
       LEFT JOIN agents a ON a.id = hp.agency_id
       WHERE ${conds.join(" AND ")}
       ORDER BY hp.display_order, s.full_name`,
      params
    );

    res.json({ data: (rows as Record<string, unknown>[]).map(r => serializeProfile(r, user.role)) });
  } catch (err) {
    console.error("List hostess profiles error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ─── GET /hostess-profiles/available — Availability panel ────────
router.get("/hostess-profiles/available", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { branch_id } = req.query as Record<string, string>;
    if (!branch_id) { res.status(400).json({ error: "BRANCH_ID_REQUIRED" }); return; }

    const { rows } = await pool.query(
      `SELECT hp.id, hp.status, hp.available_today, hp.languages_spoken,
              s.full_name, s.employee_code,
              (SELECT storage_key FROM hostess_photos ph
               WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true
                 AND ph.is_approved = true AND ph.deleted_at IS NULL LIMIT 1) AS primary_photo,
              (SELECT MIN(price_amount) FROM hostess_services hs
               WHERE hs.hostess_profile_id = hp.id AND hs.is_active = true) AS min_service_price
       FROM hostess_profiles hp
       JOIN staff s ON s.id = hp.staff_id
       WHERE hp.branch_id = $1
         AND hp.status = 'active'
         AND hp.deleted_at IS NULL
         AND s.is_active = true AND s.deleted_at IS NULL
       ORDER BY hp.display_order, s.full_name`,
      [branch_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("Available hostesses error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ─── GET /hostess-profiles/:id — Detail ──────────────────────────
router.get("/hostess-profiles/:id", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as { user: { role: string } }).user;
    const { rows } = await pool.query(
      `SELECT hp.*,
              s.full_name, s.employee_code,
              b.name AS branch_name,
              a.name AS agent_name,
              a.commission_rate AS agency_commission_rate,
              a.commission_type AS agency_commission_type,
              EXTRACT(YEAR FROM AGE(NOW(), hp.date_of_birth)) AS age
       FROM hostess_profiles hp
       JOIN staff s ON s.id = hp.staff_id
       JOIN branches b ON b.id = hp.branch_id
       LEFT JOIN agents a ON a.id = hp.agency_id
       WHERE hp.id = $1 AND hp.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
    res.json({ data: serializeProfile(rows[0] as Record<string, unknown>, user.role) });
  } catch (err) {
    console.error("Get hostess profile error:", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ─── POST /hostess-profiles — Create ─────────────────────────────
router.post(
  "/hostess-profiles",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as unknown as { user: { id: string; role: string } }).user;
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (!body.staffId) { res.status(400).json({ error: "STAFF_ID_REQUIRED" }); return; }
      if (!body.pdpaConsentGiven) { res.status(422).json({ error: "PDPA_CONSENT_REQUIRED" }); return; }

      const { rows: staffRows } = await pool.query(
        "SELECT id, branch_id, role FROM staff WHERE id = $1 AND deleted_at IS NULL",
        [body.staffId]
      );
      if (!staffRows.length) { res.status(404).json({ error: "STAFF_NOT_FOUND" }); return; }
      const staff = staffRows[0] as { id: string; branch_id: string; role: string };
      if (staff.role !== "hostess") { res.status(422).json({ error: "STAFF_NOT_HOSTESS" }); return; }

      const { rows: existing } = await pool.query(
        "SELECT id FROM hostess_profiles WHERE staff_id = $1 AND deleted_at IS NULL",
        [body.staffId]
      );
      if (existing.length) { res.status(409).json({ error: "PROFILE_ALREADY_EXISTS" }); return; }

      const { rows } = await pool.query(
        `INSERT INTO hostess_profiles
          (staff_id, branch_id, nationality, nationality_code, date_of_birth,
           height_cm, weight_kg, body_size, bust_cm, waist_cm, hip_cm,
           intro_text, intro_translations, languages_spoken,
           status, available_today, display_order, is_featured,
           agency_id, agency_hostess_code,
           pdpa_consent_given, pdpa_consent_date, pdpa_consent_ip, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),$22,$23)
         RETURNING id`,
        [
          body.staffId, staff.branch_id,
          body.nationality ?? null, body.nationalityCode ?? null, body.dateOfBirth ?? null,
          body.heightCm ?? null, body.weightKg ?? null, body.bodySize ?? null,
          body.bustCm ?? null, body.waistCm ?? null, body.hipCm ?? null,
          body.introText ?? null, body.introTranslations ?? {}, body.languagesSpoken ?? [],
          body.status ?? "active", body.availableToday ?? true,
          body.displayOrder ?? 0, body.isFeatured ?? false,
          body.agencyId ?? null, body.agencyHostessCode ?? null,
          true, req.ip ?? null, user.id,
        ]
      );

      res.status(201).json({ data: { id: (rows[0] as { id: string }).id } });
    } catch (err) {
      console.error("Create hostess profile error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ─── PATCH /hostess-profiles/:id — Update ────────────────────────
router.patch(
  "/hostess-profiles/:id",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as unknown as { user: { id: string } }).user;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const fields: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      const map: Record<string, string> = {
        nationality: "nationality", nationalityCode: "nationality_code",
        dateOfBirth: "date_of_birth", heightCm: "height_cm", weightKg: "weight_kg",
        bodySize: "body_size", bustCm: "bust_cm", waistCm: "waist_cm", hipCm: "hip_cm",
        introText: "intro_text", introTranslations: "intro_translations",
        languagesSpoken: "languages_spoken", status: "status",
        availableToday: "available_today", displayOrder: "display_order",
        isFeatured: "is_featured", agencyId: "agency_id",
        agencyHostessCode: "agency_hostess_code",
        allowedBranchIds: "allowed_branch_ids",
      };

      const jsonbArrayFields = new Set(["allowed_branch_ids"]);
      for (const [k, col] of Object.entries(map)) {
        if (body[k] !== undefined) {
          fields.push(`${col} = $${p++}`);
          const val = body[k];
          params.push(jsonbArrayFields.has(col) && Array.isArray(val) ? JSON.stringify(val) : val);
        }
      }

      if (!fields.length) { res.status(400).json({ error: "NO_FIELDS" }); return; }

      fields.push(`updated_by = $${p++}`, `updated_at = now()`);
      params.push(user.id, req.params.id);

      await pool.query(
        `UPDATE hostess_profiles SET ${fields.join(", ")} WHERE id = $${p} AND deleted_at IS NULL`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Update hostess profile error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ─── DELETE /hostess-profiles/:id — Soft delete ──────────────────
router.delete(
  "/hostess-profiles/:id",
  authenticate,
  requireRole(...ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query(
        "UPDATE hostess_profiles SET deleted_at = now() WHERE id = $1",
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════
// SERVICES sub-resource
// ══════════════════════════════════════════════════════════════════

router.get("/hostess-profiles/:id/services", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM hostess_services WHERE hostess_profile_id = $1 ORDER BY display_order, created_at`,
      [req.params.id]
    );
    res.json({
      data: (rows as Record<string, unknown>[]).map(r => ({
        id: r.id,
        hostessProfileId: r.hostess_profile_id,
        serviceCode: r.service_code,
        serviceName: r.service_name,
        serviceTranslations: r.service_translations,
        serviceDescription: r.service_description,
        priceAmount: r.price_amount ? parseFloat(r.price_amount as string) : 0,
        currencyCode: r.currency_code,
        priceUnit: r.price_unit,
        durationMinutes: r.duration_minutes,
        isActive: r.is_active,
        minBookingHours: r.min_booking_hours,
        requiresApproval: r.requires_approval,
        hostessCommissionPct: r.hostess_commission_pct ? parseFloat(r.hostess_commission_pct as string) : null,
        agencyCommissionPct: r.agency_commission_pct ? parseFloat(r.agency_commission_pct as string) : null,
        displayOrder: r.display_order,
        createdAt: r.created_at,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post(
  "/hostess-profiles/:id/services",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!body.serviceCode || !body.serviceName || body.priceAmount === undefined) {
        res.status(400).json({ error: "REQUIRED_FIELDS_MISSING" });
        return;
      }
      const { rows } = await pool.query(
        `INSERT INTO hostess_services
          (hostess_profile_id, service_code, service_name, service_translations,
           service_description, price_amount, currency_code, price_unit,
           duration_minutes, is_active, min_booking_hours, requires_approval,
           hostess_commission_pct, agency_commission_pct, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          req.params.id, body.serviceCode, body.serviceName,
          body.serviceTranslations ?? {}, body.serviceDescription ?? null,
          body.priceAmount, body.currencyCode ?? "MYR", body.priceUnit ?? "per_hour",
          body.durationMinutes ?? null, body.isActive ?? true,
          body.minBookingHours ?? 1, body.requiresApproval ?? false,
          body.hostessCommissionPct ?? null, body.agencyCommissionPct ?? null,
          body.displayOrder ?? 0,
        ]
      );
      res.status(201).json({ data: rows[0] });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.patch(
  "/hostess-profiles/:id/services/:serviceId",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const fields: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      const map: Record<string, string> = {
        serviceName: "service_name", serviceTranslations: "service_translations",
        serviceDescription: "service_description", priceAmount: "price_amount",
        currencyCode: "currency_code", priceUnit: "price_unit",
        durationMinutes: "duration_minutes", isActive: "is_active",
        minBookingHours: "min_booking_hours", requiresApproval: "requires_approval",
        hostessCommissionPct: "hostess_commission_pct",
        agencyCommissionPct: "agency_commission_pct",
        displayOrder: "display_order",
      };
      for (const [k, col] of Object.entries(map)) {
        if (body[k] !== undefined) { fields.push(`${col} = $${p++}`); params.push(body[k]); }
      }
      if (!fields.length) { res.status(400).json({ error: "NO_FIELDS" }); return; }
      fields.push(`updated_at = now()`);
      params.push(req.params.serviceId);
      await pool.query(
        `UPDATE hostess_services SET ${fields.join(", ")} WHERE id = $${p}`,
        params
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.delete(
  "/hostess-profiles/:id/services/:serviceId",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query("DELETE FROM hostess_services WHERE id = $1", [req.params.serviceId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════
// PHOTOS sub-resource
// ══════════════════════════════════════════════════════════════════

router.get("/hostess-profiles/:id/photos", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as { user: { role: string } }).user;
    const managerUp = isManagerUp(user.role);
    const { rows } = await pool.query(
      `SELECT * FROM hostess_photos
       WHERE hostess_profile_id = $1 AND deleted_at IS NULL
         ${managerUp ? "" : "AND is_approved = true"}
       ORDER BY display_order, created_at`,
      [req.params.id]
    );
    res.json({
      data: (rows as Record<string, unknown>[]).map(r => ({
        id: r.id,
        hostessProfileId: r.hostess_profile_id,
        storageKey: r.storage_key,
        url: photoUrl(r.storage_key as string),
        thumbSm: r.thumb_key_sm ? photoUrl(r.thumb_key_sm as string) : photoUrl(r.storage_key as string),
        thumbMd: r.thumb_key_md ? photoUrl(r.thumb_key_md as string) : photoUrl(r.storage_key as string),
        thumbLg: r.thumb_key_lg ? photoUrl(r.thumb_key_lg as string) : photoUrl(r.storage_key as string),
        isPrimary: r.is_primary,
        displayOrder: r.display_order,
        isApproved: r.is_approved,
        approvedAt: r.approved_at,
        mimeType: r.mime_type,
        createdAt: r.created_at,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

function photoUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http")) return key;
  return `/uploads/hostess-photos/${path.basename(key)}`;
}

router.post(
  "/hostess-profiles/:id/photos",
  authenticate,
  requireRole(...MANAGER_UP),
  upload.single("photo"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ error: "NO_FILE" }); return; }

      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) as cnt FROM hostess_photos WHERE hostess_profile_id = $1 AND deleted_at IS NULL",
        [req.params.id]
      );
      const cnt = parseInt((countRows[0] as { cnt: string }).cnt);
      if (cnt >= 7) { res.status(422).json({ error: "MAX_PHOTOS_REACHED" }); return; }

      const storageKey = req.file.filename;
      const isPrimary = cnt === 0;

      const { rows } = await pool.query(
        `INSERT INTO hostess_photos
          (hostess_profile_id, storage_key, original_filename, file_size_bytes,
           mime_type, is_primary, display_order, is_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)
         RETURNING *`,
        [req.params.id, storageKey, req.file.originalname,
         req.file.size, req.file.mimetype, isPrimary, cnt]
      );

      const photo = rows[0] as Record<string, unknown>;
      res.status(201).json({
        data: {
          id: photo.id,
          url: photoUrl(photo.storage_key as string),
          isPrimary: photo.is_primary,
          isApproved: photo.is_approved,
        }
      });
    } catch (err) {
      console.error("Upload photo error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.patch(
  "/hostess-profiles/:id/photos/:photoId",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as unknown as { user: { id: string } }).user;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const updates: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (body.isPrimary !== undefined) { updates.push(`is_primary = $${p++}`); params.push(body.isPrimary); }
      if (body.displayOrder !== undefined) { updates.push(`display_order = $${p++}`); params.push(body.displayOrder); }
      if (body.isApproved !== undefined) {
        updates.push(`is_approved = $${p++}`, `approved_by = $${p++}`, `approved_at = now()`);
        params.push(body.isApproved, user.id);
      }
      if (!updates.length) { res.status(400).json({ error: "NO_FIELDS" }); return; }
      params.push(req.params.photoId);
      await pool.query(`UPDATE hostess_photos SET ${updates.join(", ")} WHERE id = $${p}`, params);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.delete(
  "/hostess-profiles/:id/photos/:photoId",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query(
        "UPDATE hostess_photos SET deleted_at = now() WHERE id = $1",
        [req.params.photoId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ─── PATCH /hostess-profiles/:id/availability ────────────────────
router.patch(
  "/hostess-profiles/:id/availability",
  authenticate,
  requireRole(...MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { availableToday } = (req.body ?? {}) as { availableToday: boolean };
      await pool.query(
        "UPDATE hostess_profiles SET available_today = $1, updated_at = now() WHERE id = $2",
        [availableToday, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
