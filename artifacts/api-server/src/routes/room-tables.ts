import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

const MANAGER_UP = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER];
const ADMIN_UP   = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

// ─── LIST ───────────────────────────────────────────────────────────────────
router.get(
  "/room-tables",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, type, status, search } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = ["rt.branch_id IS NOT NULL"];

      if (branch_id) { params.push(branch_id); conds.push(`rt.branch_id = $${params.length}`); }
      if (type)      { params.push(type);      conds.push(`rt.type = $${params.length}`); }
      if (status)    { params.push(status);    conds.push(`rt.status = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        conds.push(`(rt.name ILIKE $${params.length} OR rt.description ILIKE $${params.length} OR rt.floor ILIKE $${params.length})`);
      }

      const { rows } = await pool.query(
        `SELECT
           rt.*,
           b.name AS branch_name,
           (SELECT COUNT(*)::int FROM room_table_pricing rtp WHERE rtp.room_table_id = rt.id AND rtp.is_active = true) AS pricing_count,
           (SELECT json_agg(json_build_object(
              'id', rtp.id, 'priceLabel', rtp.price_label,
              'priceType', rtp.price_type, 'basePrice', rtp.base_price,
              'applicableDays', rtp.applicable_days, 'priority', rtp.priority
           ) ORDER BY rtp.priority DESC) FROM room_table_pricing rtp
            WHERE rtp.room_table_id = rt.id AND rtp.is_active = true) AS active_pricing
         FROM room_tables rt
         JOIN branches b ON b.id = rt.branch_id
         WHERE ${conds.join(" AND ")}
         ORDER BY b.name, rt.sort_order, rt.name`,
        params
      );

      const summary = {
        total:        rows.length,
        active:       rows.filter(r => r.status === "ACTIVE").length,
        maintenance:  rows.filter(r => r.status === "MAINTENANCE").length,
        outOfOrder:   rows.filter(r => r.status === "OUT_OF_ORDER").length,
        inactive:     rows.filter(r => r.status === "INACTIVE").length,
      };

      res.json({ data: rows, summary });
    } catch (err) {
      console.error("[room-tables] list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── CREATE ──────────────────────────────────────────────────────────────────
router.post(
  "/room-tables",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        branchId, name, type, capacityMin = 1, capacityMax,
        description, amenities, floor, status = "ACTIVE",
        imageUrls, sortOrder = 0,
      } = req.body as Record<string, unknown>;

      if (!branchId || !name || !type || !capacityMax) {
        res.status(400).json({ error: "branchId, name, type, capacityMax are required" });
        return;
      }

      const validTypes = ["ROOM", "TABLE", "BOOTH"];
      if (!validTypes.includes(type as string)) {
        res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO room_tables
           (branch_id, name, type, capacity_min, capacity_max, description, amenities,
            floor, status, image_urls, sort_order, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          branchId, name, type, capacityMin, capacityMax,
          description ?? null,
          amenities ? JSON.stringify(amenities) : "[]",
          floor ?? null,
          status,
          imageUrls ? JSON.stringify(imageUrls) : "[]",
          sortOrder,
          (req as Request & { user?: { id?: string } }).user?.id ?? null,
        ]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "A room/table with this name already exists in this branch" });
        return;
      }
      console.error("[room-tables] create error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── GET SINGLE ──────────────────────────────────────────────────────────────
router.get(
  "/room-tables/:id",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT rt.*, b.name AS branch_name
         FROM room_tables rt
         JOIN branches b ON b.id = rt.branch_id
         WHERE rt.id = $1`,
        [id]
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

      const { rows: pricing } = await pool.query(
        `SELECT * FROM room_table_pricing WHERE room_table_id = $1 ORDER BY priority DESC, price_label`,
        [id]
      );

      res.json({ data: { ...rows[0], pricing } });
    } catch (err) {
      console.error("[room-tables] get error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── UPDATE ──────────────────────────────────────────────────────────────────
router.patch(
  "/room-tables/:id",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      const map: Record<string, string> = {
        name: "name", type: "type", capacityMin: "capacity_min",
        capacityMax: "capacity_max", description: "description",
        floor: "floor", status: "status", sortOrder: "sort_order",
      };

      for (const [jsKey, dbCol] of Object.entries(map)) {
        if (body[jsKey] !== undefined) {
          params.push(body[jsKey]);
          sets.push(`${dbCol} = $${params.length}`);
        }
      }
      if (body.amenities !== undefined) {
        params.push(JSON.stringify(body.amenities));
        sets.push(`amenities = $${params.length}`);
      }
      if (body.imageUrls !== undefined) {
        params.push(JSON.stringify(body.imageUrls));
        sets.push(`image_urls = $${params.length}`);
      }

      if (!sets.length) { res.status(400).json({ error: "No fields to update" }); return; }
      sets.push(`updated_at = NOW()`);
      params.push(id);

      const { rows } = await pool.query(
        `UPDATE room_tables SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ data: rows[0] });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "A room/table with this name already exists in this branch" });
        return;
      }
      console.error("[room-tables] update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── SOFT DELETE ─────────────────────────────────────────────────────────────
router.delete(
  "/room-tables/:id",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `UPDATE room_tables SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[room-tables] delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── EFFECTIVE PRICE ─────────────────────────────────────────────────────────
router.get(
  "/room-tables/:id/effective-price",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const datetime = (req.query.datetime as string) || new Date().toISOString();
      const { rows } = await pool.query(
        `SELECT * FROM get_applicable_price($1, $2::timestamptz)`,
        [id, datetime]
      );
      res.json({ data: rows[0] ?? null });
    } catch (err) {
      console.error("[room-tables] effective-price error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PRICING RULES ───────────────────────────────────────────────────────────
router.get(
  "/room-tables/:id/pricing",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM room_table_pricing WHERE room_table_id = $1 ORDER BY priority DESC, price_label`,
        [req.params.id]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("[room-tables] pricing list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/room-tables/:id/pricing",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        priceLabel, priceType = "PER_HOUR", basePrice, currencyCode = "MYR",
        applicableDays = 127, timeStart, timeEnd, dateFrom, dateTo,
        priority = 0, notes,
      } = req.body as Record<string, unknown>;

      if (!priceLabel || basePrice === undefined) {
        res.status(400).json({ error: "priceLabel and basePrice are required" });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO room_table_pricing
           (room_table_id, price_label, price_type, base_price, currency_code,
            applicable_days, time_start, time_end, date_from, date_to, priority, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          id, priceLabel, priceType, basePrice, currencyCode,
          applicableDays, timeStart ?? null, timeEnd ?? null,
          dateFrom ?? null, dateTo ?? null, priority, notes ?? null,
          (req as Request & { user?: { id?: string } }).user?.id ?? null,
        ]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error("[room-tables] pricing create error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.patch(
  "/room-tables/:id/pricing/:priceId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { priceId } = req.params;
      const body = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      const map: Record<string, string> = {
        priceLabel: "price_label", priceType: "price_type", basePrice: "base_price",
        currencyCode: "currency_code", applicableDays: "applicable_days",
        timeStart: "time_start", timeEnd: "time_end",
        dateFrom: "date_from", dateTo: "date_to",
        priority: "priority", notes: "notes", isActive: "is_active",
      };

      for (const [jsKey, dbCol] of Object.entries(map)) {
        if (body[jsKey] !== undefined) {
          params.push(body[jsKey]);
          sets.push(`${dbCol} = $${params.length}`);
        }
      }
      if (!sets.length) { res.status(400).json({ error: "No fields to update" }); return; }
      sets.push(`updated_at = NOW()`);
      params.push(priceId);

      const { rows } = await pool.query(
        `UPDATE room_table_pricing SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("[room-tables] pricing update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.delete(
  "/room-tables/:id/pricing/:priceId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { priceId } = req.params;
      const { rows } = await pool.query(
        `DELETE FROM room_table_pricing WHERE id = $1 RETURNING id`,
        [priceId]
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[room-tables] pricing delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
