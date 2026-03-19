import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole, requireBranchAccess } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// List branches
router.get(
  "/branches",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const isSuperUser = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user!.role as typeof ROLES[keyof typeof ROLES]);

      const query = isSuperUser
        ? `SELECT b.*, o.name as org_name FROM branches b JOIN organizations o ON o.id = b.org_id WHERE b.deleted_at IS NULL ORDER BY b.name`
        : `SELECT b.*, o.name as org_name FROM branches b JOIN organizations o ON o.id = b.org_id WHERE b.id = $1 AND b.deleted_at IS NULL`;

      const { rows } = isSuperUser
        ? await pool.query(query)
        : await pool.query(query, [req.user!.branchId]);

      res.json({ data: rows.map(formatBranch) });
    } catch (err) {
      console.error("List branches error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create branch
router.post(
  "/branches",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO branches (org_id, name, internal_code, address, city, country, phone, email, timezone, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [body.orgId, body.name, body.internalCode, body.address, body.city, body.country ?? "MY",
         body.phone, body.email, body.timezone ?? "Asia/Kuala_Lumpur", body.currency ?? "MYR"]
      );
      res.status(201).json({ data: formatBranch(rows[0]) });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "DUPLICATE_CODE", message: "Internal code already exists" });
      } else {
        console.error("Create branch error:", err);
        res.status(500).json({ error: "INTERNAL_ERROR" });
      }
    }
  }
);

// Get branch detail
router.get(
  "/branches/:id",
  authenticate,
  requireBranchAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT b.*, o.name as org_name FROM branches b JOIN organizations o ON o.id = b.org_id WHERE b.id = $1 AND b.deleted_at IS NULL`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ data: formatBranch(rows[0]) });
    } catch (err) {
      console.error("Get branch error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Update branch
router.put(
  "/branches/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE branches
         SET name = COALESCE($1, name),
             address = COALESCE($2, address),
             city = COALESCE($3, city),
             phone = COALESCE($4, phone),
             email = COALESCE($5, email),
             is_active = COALESCE($6, is_active),
             tax_config = COALESCE($7::jsonb, tax_config),
             settings = COALESCE($8::jsonb, settings)
         WHERE id = $9 AND deleted_at IS NULL
         RETURNING *`,
        [body.name, body.address, body.city, body.phone, body.email,
         body.isActive, body.taxConfig ? JSON.stringify(body.taxConfig) : null,
         body.settings ? JSON.stringify(body.settings) : null, req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ data: formatBranch(rows[0]) });
    } catch (err) {
      console.error("Update branch error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Branch dashboard
router.get(
  "/branches/:id/dashboard",
  authenticate,
  requireBranchAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.id;

      const { rows: branchRows } = await pool.query(
        `SELECT name, timezone FROM branches WHERE id = $1 AND deleted_at IS NULL`,
        [branchId]
      );
      if (!branchRows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const branch = branchRows[0] as { name: string; timezone: string };

      const today = new Date().toISOString().split("T")[0];

      const [revenueRes, reservationRes, roomsRes] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders
           WHERE branch_id = $1 AND DATE(created_at AT TIME ZONE $2) = $3`,
          [branchId, branch.timezone, today]
        ),
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status NOT IN ('cancelled','no_show')) as total,
             COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in
           FROM reservations WHERE branch_id = $1 AND reservation_date = $2`,
          [branchId, today]
        ),
        pool.query(
          `SELECT status, COUNT(*) as count FROM rooms
           WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL
           GROUP BY status`,
          [branchId]
        ),
      ]);

      const roomStats = { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
      for (const row of roomsRes.rows as { status: string; count: string }[]) {
        const count = parseInt(row.count);
        roomStats.total += count;
        if (row.status === "available") roomStats.available = count;
        else if (row.status === "occupied") roomStats.occupied = count;
        else if (row.status === "cleaning") roomStats.cleaning = count;
        else if (row.status === "maintenance") roomStats.maintenance = count;
      }

      const checkedIn = parseInt((reservationRes.rows[0] as Record<string, string>).checked_in) || 0;
      const occupancyPct = roomStats.total > 0
        ? Math.round((roomStats.occupied / roomStats.total) * 100)
        : 0;

      const localTime = new Date().toLocaleString("en-US", { timeZone: branch.timezone, hour12: false });

      res.json({
        branchId,
        branchName: branch.name,
        localTime,
        today: {
          revenue: parseFloat((revenueRes.rows[0] as Record<string, string>).revenue) || 0,
          reservationCount: parseInt((reservationRes.rows[0] as Record<string, string>).total) || 0,
          checkedInCount: checkedIn,
          occupancyPct,
        },
        rooms: roomStats,
        arrivals: [],
        departures: [],
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Room board snapshot
router.get(
  "/branches/:id/room-board",
  authenticate,
  requireBranchAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.id;

      const { rows: branchRows } = await pool.query(
        `SELECT name FROM branches WHERE id = $1 AND deleted_at IS NULL`,
        [branchId]
      );
      if (!branchRows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }

      const { rows } = await pool.query(
        `SELECT r.*,
           res.reservation_no,
           res.customer_name AS guest_name,
           res.guest_count,
           res.checked_in_at AS check_in_time,
           res.end_time AS expected_check_out
         FROM rooms r
         LEFT JOIN reservations res ON res.room_id = r.id AND res.status = 'checked_in'
         WHERE r.branch_id = $1 AND r.is_active = true AND r.deleted_at IS NULL
         ORDER BY r.sort_order, r.name`,
        [branchId]
      );

      res.json({
        branchId,
        branchName: (branchRows[0] as { name: string }).name,
        rooms: rows.map(formatRoomWithReservation),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Room board error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

function formatBranch(row: Record<string, unknown>) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    internalCode: row.internal_code,
    address: row.address,
    city: row.city,
    country: row.country,
    phone: row.phone,
    email: row.email,
    timezone: row.timezone,
    currency: row.currency,
    isActive: row.is_active,
    taxConfig: row.tax_config,
    settings: row.settings,
    createdAt: row.created_at,
  };
}

function formatRoomWithReservation(row: Record<string, unknown>) {
  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    roomType: row.room_type,
    capacityMin: row.capacity_min,
    capacityMax: row.capacity_max,
    hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate as string) : null,
    minHours: parseFloat(row.min_hours as string),
    status: row.status,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    description: row.description,
    floorLevel: row.floor_level,
    createdAt: row.created_at,
    reservationNo: row.reservation_no ?? null,
    guestName: row.guest_name ?? null,
    guestCount: row.guest_count ?? null,
    checkInTime: row.check_in_time ?? null,
    expectedCheckOut: row.expected_check_out ?? null,
  };
}

export default router;
