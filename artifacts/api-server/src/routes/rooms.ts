import { Router, type IRouter, type Request, type Response } from "express";
import { Server as SocketServer } from "socket.io";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole, requireBranchAccess } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// Shared io instance — set via initRoomSocket
let _io: SocketServer | null = null;

export function initRoomSocket(io: SocketServer): void {
  _io = io;
  io.on("connection", (socket) => {
    socket.on("join_branch", ({ branchId }: { branchId: string }) => {
      void socket.join(`branch:${branchId}`);
    });
    socket.on("leave_branch", ({ branchId }: { branchId: string }) => {
      void socket.leave(`branch:${branchId}`);
    });
  });
}

export function emitRoomUpdate(branchId: string, roomData: Record<string, unknown>): void {
  if (!_io) return;
  _io.to(`branch:${branchId}`).emit("room_board_update", {
    roomId: roomData.id,
    roomName: roomData.name,
    status: roomData.status,
    reservationNo: roomData.reservationNo ?? null,
    guestName: roomData.guestName ?? null,
    guestCount: roomData.guestCount ?? null,
    checkInTime: roomData.checkInTime ?? null,
    expectedCheckOut: roomData.expectedCheckOut ?? null,
    updatedAt: new Date().toISOString(),
  });
}

// List rooms
router.get(
  "/rooms",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.query.branch_id as string | undefined;
      const isSuperUser = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user!.role as typeof ROLES[keyof typeof ROLES]);
      const effectiveBranchId = branchId ?? (!isSuperUser ? req.user!.branchId! : undefined);

      const { rows } = effectiveBranchId
        ? await pool.query(
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
            [effectiveBranchId]
          )
        : await pool.query(
            `SELECT r.*,
               res.reservation_no,
               res.customer_name AS guest_name,
               res.guest_count,
               res.checked_in_at AS check_in_time,
               res.end_time AS expected_check_out
             FROM rooms r
             LEFT JOIN reservations res ON res.room_id = r.id AND res.status = 'checked_in'
             WHERE r.is_active = true AND r.deleted_at IS NULL
             ORDER BY r.branch_id, r.sort_order, r.name`
          );

      res.json({ data: rows.map(formatRoom) });
    } catch (err) {
      console.error("List rooms error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Available rooms
router.get(
  "/rooms/available",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, date, start_time, duration_hours } = req.query as Record<string, string>;

      const { rows } = await pool.query(
        `SELECT * FROM rooms
         WHERE branch_id = $1 AND status = 'available' AND is_active = true AND deleted_at IS NULL
         ORDER BY sort_order, name`,
        [branch_id]
      );
      res.json({ data: rows.map(formatRoom) });
    } catch (err) {
      console.error("Available rooms error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Create room
router.post(
  "/rooms",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO rooms (branch_id, name, room_type, capacity_min, capacity_max, hourly_rate, min_hours, description, floor_level, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [body.branchId, body.name, body.roomType ?? "private_room",
         body.capacityMin ?? 1, body.capacityMax, body.hourlyRate ?? null,
         body.minHours ?? 1, body.description ?? null, body.floorLevel ?? null, body.sortOrder ?? 0]
      );
      res.status(201).json({ data: formatRoom(rows[0]) });
    } catch (err) {
      console.error("Create room error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Update room
router.put(
  "/rooms/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE rooms
         SET name = COALESCE($1, name),
             room_type = COALESCE($2, room_type),
             capacity_min = COALESCE($3, capacity_min),
             capacity_max = COALESCE($4, capacity_max),
             hourly_rate = COALESCE($5, hourly_rate),
             min_hours = COALESCE($6, min_hours),
             description = COALESCE($7, description),
             floor_level = COALESCE($8, floor_level),
             sort_order = COALESCE($9, sort_order),
             is_active = COALESCE($10, is_active)
         WHERE id = $11 AND deleted_at IS NULL
         RETURNING *`,
        [body.name, body.roomType, body.capacityMin, body.capacityMax,
         body.hourlyRate, body.minHours, body.description, body.floorLevel,
         body.sortOrder, body.isActive, req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ data: formatRoom(rows[0]) });
    } catch (err) {
      console.error("Update room error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Update room status
router.put(
  "/rooms/:id/status",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.body as { status: string };
      const validStatuses = ["available", "occupied", "cleaning", "maintenance", "blocked"];

      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "INVALID_STATUS" });
        return;
      }

      const { rows } = await pool.query(
        `UPDATE rooms SET status = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
        [status, req.params.id]
      );

      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }

      const room = formatRoom(rows[0]);

      // Emit socket update to branch room
      const row = rows[0] as Record<string, unknown>;
      emitRoomUpdate(row.branch_id as string, room);

      res.json({ data: room });
    } catch (err) {
      console.error("Update room status error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

function formatRoom(row: Record<string, unknown>) {
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
