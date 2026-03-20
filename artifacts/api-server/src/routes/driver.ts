import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// Roles that can access driver endpoints
const driverAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
  ROLES.DRIVER,
);

// Auth + driverAccess shorthand
function withAuth(handler: (req: Request, res: Response) => Promise<void>) {
  return [
    (req: Request, res: Response, next: NextFunction) => authenticate(req, res, next),
    driverAccess,
    async (req: Request, res: Response) => handler(req, res),
  ];
}

// ─────────────────────────────────────────────────────────
// GET /api/driver/my-jobs
// ─────────────────────────────────────────────────────────
router.get(
  "/driver/my-jobs",
  ...withAuth(async (req, res) => {
    try {
      const user   = req.user!;
      const role   = user.role;
      const isDriver = role === ROLES.DRIVER;

      // Driver only sees their own jobs; managers can filter by driver_id
      const targetDriverId: string | null = isDriver
        ? user.id
        : ((req.query as Record<string, string>).driver_id ?? null);

      const params: unknown[] = [];
      let idx = 1;
      const conditions: string[] = ["rp.status != 'cancelled'"];

      if (targetDriverId) {
        conditions.push(`rp.driver_id = $${idx++}`);
        params.push(targetDriverId);
      }

      // Branch scope for managers
      if (!isDriver && user.branchId && role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
        conditions.push(`rp.pickup_address IS NOT NULL`); // always true — just acts as noop for non-driver
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      // Driver role: reservation_id and pickup_fee are hidden
      const reservationIdExpr = isDriver
        ? "NULL AS reservation_id"
        : "rp.reservation_id::TEXT AS reservation_id";
      const pickupFeeExpr = isDriver
        ? "NULL AS pickup_fee"
        : `rp.pickup_fee`;

      const { rows } = await pool.query(
        `SELECT
           rp.id,
           rp.pickup_address,
           rp.return_address,
           rp.pickup_time,
           rp.return_time,
           rp.status,
           rp.notes,
           ${reservationIdExpr},
           ${pickupFeeExpr},
           s.full_name AS driver_name,
           b.name      AS branch_name
         FROM reservation_pickups rp
         LEFT JOIN staff    s ON s.id = rp.driver_id
         LEFT JOIN reservations r ON r.id = rp.reservation_id
         LEFT JOIN branches  b ON b.id = r.branch_id
         ${where}
         ORDER BY rp.pickup_time ASC
         LIMIT 100`,
        params,
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[driver] my-jobs error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }),
);

// ─────────────────────────────────────────────────────────
// PATCH /api/driver/jobs/:id/status
// ─────────────────────────────────────────────────────────
const ALLOWED_DRIVER_STATUSES = ["scheduled", "en_route", "arrived", "completed", "issue_reported"];

router.patch(
  "/driver/jobs/:id/status",
  ...withAuth(async (req, res) => {
    try {
      const user   = req.user!;
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: string };

      if (!status || !ALLOWED_DRIVER_STATUSES.includes(status)) {
        res.status(400).json({
          error: "INVALID_STATUS",
          allowed: ALLOWED_DRIVER_STATUSES,
        });
        return;
      }

      // Driver role must own the job
      const params: unknown[] = [status, id];
      let ownershipClause = "";
      if (user.role === ROLES.DRIVER) {
        ownershipClause = `AND rp.driver_id = $${params.length + 1}`;
        params.push(user.id);
      }

      const { rows, rowCount } = await pool.query(
        `UPDATE reservation_pickups rp
         SET status = $1
         WHERE rp.id = $2 ${ownershipClause}
         RETURNING id, status`,
        params,
      );

      if (!rowCount || rowCount === 0) {
        res.status(404).json({ error: "JOB_NOT_FOUND_OR_NOT_ASSIGNED" });
        return;
      }

      res.json({ message: "Status updated", job: rows[0] });
    } catch (err) {
      console.error("[driver] status update error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }),
);

// ─────────────────────────────────────────────────────────
// POST /api/driver/messages
// ─────────────────────────────────────────────────────────
router.post(
  "/driver/messages",
  ...withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const { message, pickup_id } = req.body as { message?: string; pickup_id?: string };

      if (!message?.trim()) {
        res.status(400).json({ error: "MESSAGE_REQUIRED" });
        return;
      }

      // Determine branch_id: from user or from pickup
      let branchId: string | null = user.branchId ?? null;
      if (!branchId && pickup_id) {
        const pickupRes = await pool.query(
          `SELECT r.branch_id FROM reservation_pickups rp
           JOIN reservations r ON r.id = rp.reservation_id
           WHERE rp.id = $1`,
          [pickup_id],
        );
        branchId = pickupRes.rows[0]?.branch_id ?? null;
      }

      if (!branchId) {
        res.status(400).json({ error: "BRANCH_REQUIRED" });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO driver_messages (driver_id, branch_id, pickup_id, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sent_at`,
        [user.id, branchId, pickup_id ?? null, message.trim()],
      );

      res.json({ message: "Message sent", id: rows[0]!.id, sent_at: rows[0]!.sent_at });
    } catch (err) {
      console.error("[driver] message send error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/driver/messages
// ─────────────────────────────────────────────────────────
router.get(
  "/driver/messages",
  ...withAuth(async (req, res) => {
    try {
      const user = req.user!;
      const params: unknown[] = [];
      let condition = "";
      if (user.role === ROLES.DRIVER) {
        condition = "WHERE dm.driver_id = $1";
        params.push(user.id);
      } else if (user.branchId) {
        condition = "WHERE dm.branch_id = $1";
        params.push(user.branchId);
      }

      const { rows } = await pool.query(
        `SELECT dm.id, dm.message, dm.sent_at, dm.pickup_id,
                s.full_name AS driver_name
         FROM driver_messages dm
         LEFT JOIN staff s ON s.id = dm.driver_id
         ${condition}
         ORDER BY dm.sent_at DESC
         LIMIT 50`,
        params,
      );

      res.json({ data: rows, count: rows.length });
    } catch (err) {
      console.error("[driver] messages list error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }),
);

export default router;
