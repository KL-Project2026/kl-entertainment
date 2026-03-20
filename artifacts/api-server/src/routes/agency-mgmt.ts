// MIGRATION: agency-mgmt.ts → AgenciesController.cs (ASP.NET Core Minimal API)
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ─── Multer for agency images ────────────────────────────────────────────────
const agencyUploadsDir = path.join(process.cwd(), "uploads", "agency-images");
if (!fs.existsSync(agencyUploadsDir)) fs.mkdirSync(agencyUploadsDir, { recursive: true });

const agencyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, agencyUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});
const agencyUpload = multer({
  storage: agencyStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG/PNG/WEBP images are allowed"));
  },
});

// ─── Role constants ───────────────────────────────────────────────────────────
const MANAGER_UP = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER];
const ADMIN_UP   = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

// ─── Serializer ───────────────────────────────────────────────────────────────
function fmtAgent(r: Record<string, unknown>) {
  return {
    id: r.id,
    agentCode: r.agent_code ?? null,
    name: r.name,
    contactPerson: r.contact_person ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    profileImageUrl: r.profile_image_url ?? null,
    address: r.address ?? null,
    bankName: r.bank_name ?? null,
    bankAccount: r.bank_account ?? null,
    bankAccountName: r.bank_account_name ?? null,
    bankSwiftCode: r.bank_swift_code ?? null,
    bankCountry: r.bank_country ?? "MY",
    commissionRate: parseFloat(r.commission_rate as string) || 0,
    paymentCycle: r.payment_cycle ?? "monthly",
    isActive: r.is_active ?? true,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    hostessCount: parseInt(r.hostess_count as string) || 0,
    mtdSessions: parseInt(r.mtd_sessions as string) || 0,
    mtdRevenue: parseFloat(r.mtd_revenue as string) || 0,
    mtdAgentCut: parseFloat(r.mtd_agent_cut as string) || 0,
  };
}

// ─── LIST AGENCIES ────────────────────────────────────────────────────────────
router.get(
  "/agencies",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { active, search } = req.query as Record<string, string>;
      const conds: string[] = [
        "a.deleted_at IS NULL",
        "a.agent_type = 'agency'",
      ];
      const params: unknown[] = [];
      let p = 1;

      if (active !== undefined) { conds.push(`a.is_active = $${p++}`); params.push(active === "true"); }
      if (search) { conds.push(`(a.name ILIKE $${p} OR a.agent_code ILIKE $${p} OR a.contact_person ILIKE $${p})`); params.push(`%${search}%`); p++; }

      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { rows } = await pool.query(
        `SELECT a.*,
                COUNT(DISTINCT ahc.hostess_profile_id) FILTER (WHERE ahc.is_active) AS hostess_count,
                COUNT(DISTINCT hs.id)                  FILTER (WHERE hs.created_at >= $${p}) AS mtd_sessions,
                COALESCE(SUM(hs.gross_amount)          FILTER (WHERE hs.created_at >= $${p}), 0) AS mtd_revenue,
                COALESCE(SUM(hs.agent_commission)      FILTER (WHERE hs.created_at >= $${p}), 0) AS mtd_agent_cut
         FROM agents a
         LEFT JOIN agent_hostess_contracts ahc ON ahc.agent_id = a.id
         LEFT JOIN hostess_profiles hp ON hp.id = ahc.hostess_profile_id
         LEFT JOIN hostess_sessions hs ON hs.hostess_id = hp.staff_id AND hs.agent_id = a.id
         WHERE ${conds.join(" AND ")}
         GROUP BY a.id
         ORDER BY a.name`,
        [...params, mtdStart]
      );
      res.json({ data: rows.map(fmtAgent) });
    } catch (err) {
      console.error("[agencies] list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── LIST UNASSIGNED HOSTESSES (for assign modal) ─────────────────────────────
// NOTE: Must be registered BEFORE /agencies/:id to avoid route conflict
router.get(
  "/agencies/unassigned-hostesses",
  authenticate,
  requireRole(ADMIN_UP),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT hp.id, s.full_name, s.employee_code, b.name AS branch_name,
                (SELECT storage_key FROM hostess_photos ph WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true AND ph.deleted_at IS NULL LIMIT 1) AS primary_photo
         FROM hostess_profiles hp
         JOIN staff s ON s.id = hp.staff_id
         JOIN branches b ON b.id = hp.branch_id
         WHERE hp.agency_id IS NULL AND hp.deleted_at IS NULL AND hp.status = 'active'
         ORDER BY s.full_name`
      );
      res.json({ data: rows.map(r => ({ id: r.id, fullName: r.full_name, staffCode: r.employee_code, branchName: r.branch_name, primaryPhoto: r.primary_photo })) });
    } catch (err) {
      console.error("[agencies] unassigned hostesses error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── GET SINGLE AGENCY ────────────────────────────────────────────────────────
router.get(
  "/agencies/:id",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT a.*,
                COUNT(DISTINCT ahc.hostess_profile_id) FILTER (WHERE ahc.is_active) AS hostess_count,
                0 AS mtd_sessions, 0 AS mtd_revenue, 0 AS mtd_agent_cut
         FROM agents a
         LEFT JOIN agent_hostess_contracts ahc ON ahc.agent_id = a.id
         WHERE a.id = $1 AND a.deleted_at IS NULL AND a.agent_type = 'agency'
         GROUP BY a.id`,
        [id]
      );
      if (!rows.length) { res.status(404).json({ error: "Agency not found" }); return; }
      res.json({ data: fmtAgent(rows[0]) });
    } catch (err) {
      console.error("[agencies] get error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── CREATE AGENCY ────────────────────────────────────────────────────────────
router.post(
  "/agencies",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name, agentCode, contactPerson, phone, email, address, notes, isActive,
        bankName, bankAccount, bankAccountName, bankSwiftCode, bankCountry,
        commissionRate, paymentCycle, profileImageUrl,
      } = req.body;

      if (!name) { res.status(400).json({ error: "name is required" }); return; }

      const orgId = "00000000-0000-0000-0000-000000000001";
      const code = agentCode || `AGT-${String(Date.now()).slice(-4)}`;

      const { rows } = await pool.query(
        `INSERT INTO agents (
           org_id, agent_type, name, agent_code, contact_person, phone, email,
           profile_image_url, address, notes, is_active,
           bank_name, bank_account, bank_account_name, bank_swift_code, bank_country,
           commission_type, commission_rate, commission_base, payment_cycle,
           payment_method, preferred_currency
         ) VALUES (
           $1,'agency',$2,$3,$4,$5,$6,$7,$8,$9,$10,
           $11,$12,$13,$14,$15,
           'pct',$16,'hostess_gross',$17,
           'bank_transfer','MYR'
         ) RETURNING *`,
        [
          orgId, name, code, contactPerson ?? null, phone ?? null, email ?? null,
          profileImageUrl ?? null, address ?? null, notes ?? null, isActive !== false,
          bankName ?? null, bankAccount ?? null, bankAccountName ?? null, bankSwiftCode ?? null, bankCountry ?? "MY",
          commissionRate ?? 0.40, paymentCycle ?? "monthly",
        ]
      );
      res.status(201).json({ data: fmtAgent({ ...rows[0], hostess_count: 0, mtd_sessions: 0, mtd_revenue: 0, mtd_agent_cut: 0 }) });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "Agent code already exists" });
      } else {
        console.error("[agencies] create error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// ─── UPDATE AGENCY ────────────────────────────────────────────────────────────
router.patch(
  "/agencies/:id",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowedFields: Record<string, string> = {
        name: "name", agentCode: "agent_code", contactPerson: "contact_person",
        phone: "phone", email: "email", address: "address", notes: "notes",
        isActive: "is_active", profileImageUrl: "profile_image_url",
        bankName: "bank_name", bankAccount: "bank_account",
        bankAccountName: "bank_account_name", bankSwiftCode: "bank_swift_code",
        bankCountry: "bank_country", commissionRate: "commission_rate",
        paymentCycle: "payment_cycle",
      };
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let p = 1;
      for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
        if (req.body[jsKey] !== undefined) {
          sets.push(`${dbCol} = $${p++}`);
          params.push(req.body[jsKey]);
        }
      }
      params.push(id);
      const { rows } = await pool.query(
        `UPDATE agents SET ${sets.join(", ")} WHERE id = $${p} AND deleted_at IS NULL RETURNING *`,
        params
      );
      if (!rows.length) { res.status(404).json({ error: "Agency not found" }); return; }
      res.json({ data: fmtAgent({ ...rows[0], hostess_count: 0, mtd_sessions: 0, mtd_revenue: 0, mtd_agent_cut: 0 }) });
    } catch (err) {
      console.error("[agencies] update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── DELETE (soft) AGENCY ─────────────────────────────────────────────────────
router.delete(
  "/agencies/:id",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await pool.query(
        "UPDATE agents SET is_active = false, deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[agencies] delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── UPLOAD AGENCY IMAGE ──────────────────────────────────────────────────────
router.post(
  "/agencies/:id/upload-image",
  authenticate,
  requireRole(ADMIN_UP),
  agencyUpload.single("image"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const imageUrl = `/uploads/agency-images/${req.file.filename}`;
      await pool.query(
        "UPDATE agents SET profile_image_url = $1, updated_at = NOW() WHERE id = $2",
        [imageUrl, id]
      );
      res.json({ imageUrl });
    } catch (err) {
      console.error("[agencies] upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// ─── LIST HOSTESSES UNDER AGENCY ──────────────────────────────────────────────
router.get(
  "/agencies/:id/hostesses",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { from, to, search } = req.query as Record<string, string>;
      const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const toDate   = to   || new Date().toISOString().slice(0, 10);

      const conds: string[] = ["ahc.agent_id = $1", "ahc.is_active = true", "hp.deleted_at IS NULL"];
      const params: unknown[] = [id];
      let p = 2;
      if (search) { conds.push(`(s.full_name ILIKE $${p} OR s.employee_code ILIKE $${p})`); params.push(`%${search}%`); p++; }

      const { rows } = await pool.query(
        `SELECT
           ahc.id AS contract_id,
           ahc.venue_commission_rate,
           ahc.agent_commission_rate,
           ahc.session_fee_split,
           ahc.drink_commission_split,
           ahc.package_commission_split,
           ahc.contract_start,
           ahc.contract_end,
           hp.id AS hostess_profile_id,
           hp.status AS hostess_status,
           (SELECT storage_key FROM hostess_photos ph WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true AND ph.deleted_at IS NULL LIMIT 1) AS primary_photo,
           s.id AS staff_id,
           s.full_name,
           s.employee_code,
           b.name AS branch_name,
           COUNT(hs.id)                                               AS sessions_count,
           COALESCE(SUM(hs.gross_amount), 0)                          AS gross_revenue,
           COALESCE(SUM(hs.gross_amount * ahc.agent_commission_rate / 100), 0) AS agent_cut,
           COALESCE(SUM(hs.gross_amount * ahc.venue_commission_rate / 100), 0) AS hostess_earnings
         FROM agent_hostess_contracts ahc
         JOIN hostess_profiles hp ON hp.id = ahc.hostess_profile_id
         JOIN staff s ON s.id = hp.staff_id
         JOIN branches b ON b.id = hp.branch_id
         LEFT JOIN hostess_sessions hs
           ON hs.hostess_id = s.id
           AND hs.agent_id = $1
           AND hs.start_at::date BETWEEN $${p}::date AND $${p+1}::date
           AND hs.status = 'active'
         WHERE ${conds.join(" AND ")}
         GROUP BY ahc.id, hp.id, s.id, b.name
         ORDER BY s.full_name`,
        [...params, fromDate, toDate]
      );
      p += 2;

      res.json({
        data: rows.map(r => ({
          contractId: r.contract_id,
          hostessProfileId: r.hostess_profile_id,
          staffId: r.staff_id,
          fullName: r.full_name,
          staffCode: r.employee_code,
          branchName: r.branch_name,
          hostessStatus: r.hostess_status,
          primaryPhoto: r.primary_photo ?? null,
          venueCommissionRate: parseFloat(r.venue_commission_rate),
          agentCommissionRate: parseFloat(r.agent_commission_rate),
          sessionFeeSplit: parseFloat(r.session_fee_split),
          drinkCommissionSplit: parseFloat(r.drink_commission_split),
          packageCommissionSplit: parseFloat(r.package_commission_split),
          contractStart: r.contract_start,
          contractEnd: r.contract_end ?? null,
          sessionsCount: parseInt(r.sessions_count) || 0,
          grossRevenue: parseFloat(r.gross_revenue) || 0,
          agentCut: parseFloat(r.agent_cut) || 0,
          hostessEarnings: parseFloat(r.hostess_earnings) || 0,
        })),
      });
    } catch (err) {
      console.error("[agencies] hostesses error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── ASSIGN HOSTESS TO AGENCY ─────────────────────────────────────────────────
router.post(
  "/agencies/:id/hostesses",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        hostessProfileId, venueCommissionRate, agentCommissionRate,
        sessionFeeSplit, drinkCommissionSplit, packageCommissionSplit,
        contractStart, contractEnd,
      } = req.body;

      if (!hostessProfileId) { res.status(400).json({ error: "hostessProfileId is required" }); return; }
      const vRate = parseFloat(venueCommissionRate) || 60;
      const aRate = parseFloat(agentCommissionRate) || 40;
      if (Math.abs((vRate + aRate) - 100) > 0.01) {
        res.status(400).json({ error: "venue + agent commission rates must equal 100" }); return;
      }

      // Deactivate existing active contract
      await pool.query(
        "UPDATE agent_hostess_contracts SET is_active = false WHERE hostess_profile_id = $1 AND is_active = true",
        [hostessProfileId]
      );

      const { rows } = await pool.query(
        `INSERT INTO agent_hostess_contracts (
           agent_id, hostess_profile_id,
           venue_commission_rate, agent_commission_rate,
           session_fee_split, drink_commission_split, package_commission_split,
           contract_start, contract_end, is_active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
        [
          id, hostessProfileId, vRate, aRate,
          sessionFeeSplit ?? 60, drinkCommissionSplit ?? 50, packageCommissionSplit ?? 55,
          contractStart || new Date().toISOString().slice(0, 10),
          contractEnd ?? null,
        ]
      );

      // Update hostess_profiles.agency_id
      await pool.query(
        "UPDATE hostess_profiles SET agency_id = $1 WHERE id = $2",
        [id, hostessProfileId]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("[agencies] assign hostess error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── UPDATE CONTRACT ──────────────────────────────────────────────────────────
router.patch(
  "/agencies/:id/hostesses/:contractId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, contractId } = req.params;
      const {
        venueCommissionRate, agentCommissionRate,
        sessionFeeSplit, drinkCommissionSplit, packageCommissionSplit,
        contractEnd, isActive,
      } = req.body;

      if (venueCommissionRate !== undefined && agentCommissionRate !== undefined) {
        const v = parseFloat(venueCommissionRate), a = parseFloat(agentCommissionRate);
        if (Math.abs((v + a) - 100) > 0.01) {
          res.status(400).json({ error: "venue + agent commission rates must equal 100" }); return;
        }
      }

      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let p = 1;
      const fieldMap: Record<string, string> = {
        venueCommissionRate: "venue_commission_rate",
        agentCommissionRate: "agent_commission_rate",
        sessionFeeSplit: "session_fee_split",
        drinkCommissionSplit: "drink_commission_split",
        packageCommissionSplit: "package_commission_split",
        contractEnd: "contract_end",
        isActive: "is_active",
      };
      for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
        if (req.body[jsKey] !== undefined) {
          sets.push(`${dbCol} = $${p++}`);
          params.push(req.body[jsKey]);
        }
      }
      params.push(contractId, id);
      const { rows } = await pool.query(
        `UPDATE agent_hostess_contracts SET ${sets.join(", ")}
         WHERE id = $${p} AND agent_id = $${p+1} RETURNING *`,
        params
      );
      if (!rows.length) { res.status(404).json({ error: "Contract not found" }); return; }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("[agencies] update contract error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── REMOVE HOSTESS FROM AGENCY ───────────────────────────────────────────────
router.delete(
  "/agencies/:id/hostesses/:contractId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, contractId } = req.params;
      const { rows } = await pool.query(
        `UPDATE agent_hostess_contracts SET is_active = false, contract_end = CURRENT_DATE
         WHERE id = $1 AND agent_id = $2 RETURNING hostess_profile_id`,
        [contractId, id]
      );
      if (rows[0]?.hostess_profile_id) {
        await pool.query(
          "UPDATE hostess_profiles SET agency_id = NULL WHERE id = $1 AND agency_id = $2",
          [rows[0].hostess_profile_id, id]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[agencies] remove hostess error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── ACCOUNT SUMMARY ──────────────────────────────────────────────────────────
router.get(
  "/agencies/:id/account-summary",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { from, to } = req.query as Record<string, string>;
      const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const toDate   = to   || new Date().toISOString().slice(0, 10);

      // Agent info
      const { rows: agentRows } = await pool.query(
        "SELECT id, name, agent_code, profile_image_url FROM agents WHERE id = $1",
        [id]
      );
      if (!agentRows.length) { res.status(404).json({ error: "Agency not found" }); return; }
      const agent = agentRows[0];

      // Hostess breakdown
      const { rows: breakdownRows } = await pool.query(
        `SELECT
           s.id AS staff_id,
           s.full_name,
           ( SELECT storage_key FROM hostess_photos ph WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true AND ph.deleted_at IS NULL LIMIT 1 ) AS photo_url,
           ahc.venue_commission_rate,
           ahc.agent_commission_rate,
           COUNT(hs.id)                                               AS sessions_count,
           COALESCE(SUM(hs.gross_amount), 0)                          AS gross_revenue,
           COALESCE(SUM(hs.gross_amount * ahc.agent_commission_rate / 100), 0) AS agent_cut,
           COALESCE(SUM(hs.gross_amount * ahc.venue_commission_rate / 100), 0) AS hostess_earnings
         FROM agent_hostess_contracts ahc
         JOIN hostess_profiles hp ON hp.id = ahc.hostess_profile_id
         JOIN staff s ON s.id = hp.staff_id
         LEFT JOIN hostess_sessions hs
           ON hs.hostess_id = s.id
           AND hs.agent_id = $1
           AND hs.start_at::date BETWEEN $2::date AND $3::date
           AND hs.status = 'active'
         WHERE ahc.agent_id = $1 AND ahc.is_active = true AND hp.deleted_at IS NULL
         GROUP BY s.id, hp.id, ahc.venue_commission_rate, ahc.agent_commission_rate
         ORDER BY gross_revenue DESC`,
        [id, fromDate, toDate]
      );

      const totalSessions = breakdownRows.reduce((s, r) => s + parseInt(r.sessions_count), 0);
      const grossRevenue = breakdownRows.reduce((s, r) => s + parseFloat(r.gross_revenue), 0);
      const agentTotalCut = breakdownRows.reduce((s, r) => s + parseFloat(r.agent_cut), 0);
      const hostessTotalEarnings = breakdownRows.reduce((s, r) => s + parseFloat(r.hostess_earnings), 0);

      res.json({
        agent: { name: agent.name, code: agent.agent_code, profileImageUrl: agent.profile_image_url },
        period: { from: fromDate, to: toDate },
        summary: {
          totalHostesses: breakdownRows.length,
          totalSessions,
          grossRevenue,
          agentTotalCut,
          hostessTotalEarnings,
        },
        hostessBreakdown: breakdownRows.map(r => ({
          staffId: r.staff_id,
          name: r.full_name,
          photoUrl: r.photo_url ?? null,
          sessionsCount: parseInt(r.sessions_count) || 0,
          grossRevenue: parseFloat(r.gross_revenue) || 0,
          agentCut: parseFloat(r.agent_cut) || 0,
          hostessEarnings: parseFloat(r.hostess_earnings) || 0,
          commissionRate: `${parseFloat(r.venue_commission_rate)}% / ${parseFloat(r.agent_commission_rate)}%`,
        })),
      });
    } catch (err) {
      console.error("[agencies] account-summary error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── FULL REVENUE DRILL-DOWN ───────────────────────────────────────────────────
router.get(
  "/agencies/:id/hostesses/:contractId/revenue-detail",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, contractId } = req.params;
      const { from, to } = req.query as Record<string, string>;
      const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const toDate   = to   || new Date().toISOString().slice(0, 10);

      // Get contract + hostess info
      const { rows: contractRows } = await pool.query(
        `SELECT ahc.*, s.full_name, s.id AS staff_id,
                (SELECT storage_key FROM hostess_photos ph WHERE ph.hostess_profile_id = hp.id AND ph.is_primary = true AND ph.deleted_at IS NULL LIMIT 1) AS primary_photo,
                ahc.venue_commission_rate, ahc.agent_commission_rate
         FROM agent_hostess_contracts ahc
         JOIN hostess_profiles hp ON hp.id = ahc.hostess_profile_id
         JOIN staff s ON s.id = hp.staff_id
         WHERE ahc.id = $1 AND ahc.agent_id = $2`,
        [contractId, id]
      );
      if (!contractRows.length) { res.status(404).json({ error: "Contract not found" }); return; }
      const contract = contractRows[0];

      // Session-level breakdown
      const { rows: sessions } = await pool.query(
        `SELECT
           hs.id,
           hs.start_at::date AS session_date,
           r.reservation_code,
           rm.room_number AS room_name,
           hs.hours_worked,
           hs.gross_amount,
           hs.gross_amount * $3::decimal / 100 AS agent_cut,
           hs.gross_amount * $4::decimal / 100 AS hostess_earnings,
           hs.notes,
           hs.status
         FROM hostess_sessions hs
         LEFT JOIN reservations r ON r.id = hs.reservation_id
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE hs.hostess_id = $1
           AND hs.agent_id = $2
           AND hs.start_at::date BETWEEN $5::date AND $6::date
           AND hs.status = 'active'
         ORDER BY hs.start_at`,
        [
          contract.staff_id, id,
          contract.agent_commission_rate, contract.venue_commission_rate,
          fromDate, toDate,
        ]
      );

      const totals = sessions.reduce(
        (acc, s) => ({
          grossRevenue: acc.grossRevenue + (parseFloat(s.gross_amount) || 0),
          agentCut: acc.agentCut + (parseFloat(s.agent_cut) || 0),
          hostessEarnings: acc.hostessEarnings + (parseFloat(s.hostess_earnings) || 0),
          sessions: acc.sessions + 1,
        }),
        { grossRevenue: 0, agentCut: 0, hostessEarnings: 0, sessions: 0 }
      );

      res.json({
        hostess: { name: contract.full_name, photoUrl: contract.primary_photo ?? null },
        commissionRate: `${contract.venue_commission_rate}% / ${contract.agent_commission_rate}%`,
        period: { from: fromDate, to: toDate },
        sessions: sessions.map(s => ({
          id: s.id,
          sessionDate: s.session_date,
          reservationCode: s.reservation_code ?? null,
          roomName: s.room_name ?? null,
          hoursWorked: parseFloat(s.hours_worked) || 0,
          grossAmount: parseFloat(s.gross_amount) || 0,
          agentCut: parseFloat(s.agent_cut) || 0,
          hostessEarnings: parseFloat(s.hostess_earnings) || 0,
          notes: s.notes ?? null,
        })),
        totals,
      });
    } catch (err) {
      console.error("[agencies] revenue-detail error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
