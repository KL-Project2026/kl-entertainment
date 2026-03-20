import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";
import { getSharedIo } from "./rooms";

const router: IRouter = Router();

const MANAGER_UP = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER];
const ADMIN_UP   = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

type AuthReq = Request & { user?: { id?: string } };

async function writeAudit(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string | undefined,
  branchId: string | null,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  ip: string | undefined,
  ua: string | undefined,
): Promise<void> {
  void branchId;
  try {
    await pool.query(
      `INSERT INTO audit_log
         (entity_type, entity_id, action, changed_by, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
      [
        entityType, entityId, action,
        actorId ?? null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip ?? null,
        ua ?? null,
      ]
    );
  } catch {
    // non-blocking
  }
}

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
        total:       rows.length,
        active:      rows.filter(r => r.status === "ACTIVE").length,
        maintenance: rows.filter(r => r.status === "MAINTENANCE").length,
        outOfOrder:  rows.filter(r => r.status === "OUT_OF_ORDER").length,
        inactive:    rows.filter(r => r.status === "INACTIVE").length,
      };

      res.json({ data: rows, summary });
    } catch (err) {
      console.error("[room-tables] list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────
// GET /api/room-tables/availability?date=2026-03-21&branch_id=uuid
router.get(
  "/room-tables/availability",
  authenticate,
  requireRole(MANAGER_UP),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, branch_id } = req.query as Record<string, string>;

      if (!date || !branch_id) {
        res.status(400).json({ error: "date and branch_id are required" });
        return;
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: "date must be YYYY-MM-DD" });
        return;
      }

      // Fetch room_tables for this branch
      const { rows: roomTables } = await pool.query<{
        id: string; name: string; type: string;
        capacity_max: number; status: string; branch_id: string;
      }>(
        `SELECT id, name, type, capacity_max, status, branch_id
         FROM room_tables
         WHERE branch_id = $1
         ORDER BY sort_order, name`,
        [branch_id]
      );

      if (!roomTables.length) {
        res.json({ date, branch_id, room_tables: [], daily_total_revenue: 0, currency_code: "MYR" });
        return;
      }

      // Try to join with reservations via rooms table (name+branch_id match)
      // Also do a direct branch_id match with reservation_date
      const { rows: reservations } = await pool.query<{
        id: string; customer_name: string | null; guest_count: number;
        start_time: string; end_time: string | null; status: string;
        room_id: string | null; room_name: string | null;
        deposit_amount: string;
      }>(
        `SELECT
           r.id, r.customer_name, r.guest_count,
           r.start_time, r.end_time, r.status,
           r.room_id, rm.name AS room_name,
           r.deposit_amount
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         WHERE r.branch_id = $1
           AND r.reservation_date = $2
           AND r.status NOT IN ('cancelled', 'no_show')
         ORDER BY r.start_time`,
        [branch_id, date]
      );

      // Map reservations by room name for matching with room_tables
      const resByRoomName = new Map<string, typeof reservations>();
      for (const res of reservations) {
        const key = (res.room_name ?? "").toLowerCase();
        if (!resByRoomName.has(key)) resByRoomName.set(key, []);
        resByRoomName.get(key)!.push(res);
      }

      // Resolve applicable price for each room_table at noon on the date
      const noonTs = `${date}T12:00:00+08:00`;

      const result = await Promise.all(
        roomTables.map(async (rt) => {
          const { rows: priceRows } = await pool.query(
            `SELECT * FROM get_applicable_price($1, $2::timestamptz)`,
            [rt.id, noonTs]
          );
          const applicablePrice = priceRows[0] ?? null;

          const rtReservations = resByRoomName.get(rt.name.toLowerCase()) ?? [];
          const dailyRevenue = rtReservations.reduce((sum, r) => sum + parseFloat(r.deposit_amount || "0"), 0);

          return {
            id:           rt.id,
            name:         rt.name,
            type:         rt.type,
            capacity_max: rt.capacity_max,
            status:       rt.status,
            daily_revenue: dailyRevenue,
            currency_code: "MYR",
            reservations: rtReservations.map(r => ({
              reservation_id: r.id,
              guest_name:     r.customer_name ?? "Guest",
              start_time:     r.start_time,
              end_time:       r.end_time,
              status:         r.status,
              pax:            r.guest_count,
              revenue:        parseFloat(r.deposit_amount || "0"),
            })),
            applicable_price: applicablePrice ? {
              price_label:   applicablePrice.price_label,
              base_price:    parseFloat(applicablePrice.base_price),
              price_type:    applicablePrice.price_type,
              currency_code: applicablePrice.currency_code ?? "MYR",
            } : null,
          };
        })
      );

      const dailyTotalRevenue = result.reduce((sum, rt) => sum + rt.daily_revenue, 0);

      res.json({
        date,
        branch_id,
        room_tables: result,
        daily_total_revenue: dailyTotalRevenue,
        currency_code: "MYR",
      });
    } catch (err) {
      console.error("[room-tables] availability error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── CREATE ──────────────────────────────────────────────────────────────────
router.post(
  "/room-tables",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: AuthReq, res: Response): Promise<void> => {
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
      if (Number(capacityMin) > Number(capacityMax)) {
        res.status(400).json({ error: "capacity_min must be ≤ capacity_max" });
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
          floor ?? null, status,
          imageUrls ? JSON.stringify(imageUrls) : "[]",
          sortOrder,
          req.user?.id ?? null,
        ]
      );

      const created = rows[0];
      void writeAudit("room_table", created.id, "CREATE", req.user?.id, created.branch_id,
        null, created, req.ip, req.get("user-agent"));

      res.status(201).json({ data: created });
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
  async (req: AuthReq, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as Record<string, unknown>;

      // Snapshot before change
      const { rows: before } = await pool.query(
        `SELECT * FROM room_tables WHERE id = $1`, [id]
      );
      if (!before.length) { res.status(404).json({ error: "Not found" }); return; }
      const oldRow = before[0] as Record<string, unknown>;

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
      const updated = rows[0] as Record<string, unknown>;

      // Audit log
      const action = body.status !== undefined && body.status !== oldRow.status
        ? "STATUS_CHANGE" : "UPDATE";
      void writeAudit("room_table", id, action, req.user?.id,
        updated.branch_id as string, oldRow, updated, req.ip, req.get("user-agent"));

      // Socket.io emit when status changes
      if (body.status !== undefined && body.status !== oldRow.status) {
        const io = getSharedIo();
        if (io) {
          io.to(`branch:${updated.branch_id}`).emit("room_table_status_changed", {
            room_table_id: id,
            name:          updated.name,
            status:        updated.status,
            updated_at:    new Date().toISOString(),
          });
        }
      }

      res.json({ data: updated });
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
  async (req: AuthReq, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows: before } = await pool.query(`SELECT * FROM room_tables WHERE id = $1`, [id]);
      if (!before.length) { res.status(404).json({ error: "Not found" }); return; }

      const { rows } = await pool.query(
        `UPDATE room_tables SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1 RETURNING id, branch_id`,
        [id]
      );
      if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

      void writeAudit("room_table", id, "STATUS_CHANGE", req.user?.id,
        rows[0].branch_id, before[0], { ...before[0], status: "INACTIVE" },
        req.ip, req.get("user-agent"));

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

// ─── PRICING RULES LIST ──────────────────────────────────────────────────────
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

// ─── PRICING CREATE ───────────────────────────────────────────────────────────
router.post(
  "/room-tables/:id/pricing",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: AuthReq, res: Response): Promise<void> => {
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
      if (Number(basePrice) <= 0) {
        res.status(400).json({ error: "base_price must be > 0" });
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
          req.user?.id ?? null,
        ]
      );

      const created = rows[0];

      // Get branch_id for audit
      const { rows: rtRows } = await pool.query(`SELECT branch_id FROM room_tables WHERE id = $1`, [id]);
      void writeAudit("room_table_pricing", created.id, "CREATE", req.user?.id,
        rtRows[0]?.branch_id ?? null, null, created, req.ip, req.get("user-agent"));

      res.status(201).json({ data: created });
    } catch (err) {
      console.error("[room-tables] pricing create error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PRICING UPDATE ───────────────────────────────────────────────────────────
router.patch(
  "/room-tables/:id/pricing/:priceId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: AuthReq, res: Response): Promise<void> => {
    try {
      const { id, priceId } = req.params;
      const body = req.body as Record<string, unknown>;

      const { rows: before } = await pool.query(`SELECT * FROM room_table_pricing WHERE id = $1`, [priceId]);
      if (!before.length) { res.status(404).json({ error: "Not found" }); return; }

      const sets: string[] = [];
      const params: unknown[] = [];

      const map: Record<string, string> = {
        priceLabel:    "price_label",  priceType:     "price_type",
        basePrice:     "base_price",   currencyCode:  "currency_code",
        applicableDays:"applicable_days", timeStart:  "time_start",
        timeEnd:       "time_end",     dateFrom:      "date_from",
        dateTo:        "date_to",      priority:      "priority",
        notes:         "notes",        isActive:      "is_active",
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

      const updated = rows[0];
      const action = body.isActive !== undefined && body.isActive !== before[0].is_active
        ? "PRICING_DEACTIVATED" : "UPDATE";
      const { rows: rtRows } = await pool.query(`SELECT branch_id FROM room_tables WHERE id = $1`, [id]);
      void writeAudit("room_table_pricing", priceId, action, req.user?.id,
        rtRows[0]?.branch_id ?? null, before[0], updated, req.ip, req.get("user-agent"));

      res.json({ data: updated });
    } catch (err) {
      console.error("[room-tables] pricing update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── PRICING SOFT DELETE (deactivate) ────────────────────────────────────────
router.delete(
  "/room-tables/:id/pricing/:priceId",
  authenticate,
  requireRole(ADMIN_UP),
  async (req: AuthReq, res: Response): Promise<void> => {
    try {
      const { id, priceId } = req.params;
      const { rows: before } = await pool.query(`SELECT * FROM room_table_pricing WHERE id = $1`, [priceId]);
      if (!before.length) { res.status(404).json({ error: "Not found" }); return; }

      // Soft-delete: set is_active = false, never hard-delete
      await pool.query(
        `UPDATE room_table_pricing SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [priceId]
      );

      const { rows: rtRows } = await pool.query(`SELECT branch_id FROM room_tables WHERE id = $1`, [id]);
      void writeAudit("room_table_pricing", priceId, "PRICING_DEACTIVATED", req.user?.id,
        rtRows[0]?.branch_id ?? null, before[0], { ...before[0], is_active: false },
        req.ip, req.get("user-agent"));

      res.json({ success: true });
    } catch (err) {
      console.error("[room-tables] pricing delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
