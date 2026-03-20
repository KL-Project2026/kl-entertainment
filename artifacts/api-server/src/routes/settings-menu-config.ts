import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

const ADMIN_ONLY  = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const READ_ROLES  = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER];

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ── Audit helper ─────────────────────────────────────────────────────────────
async function writeAudit(
  action: string,
  entityType: string,
  entityId: string,
  changedBy: string | null,
  branchId: string | null,
  oldValue: object | null,
  newValue: object | null,
  req: Request
) {
  if (!changedBy) return;
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress ?? null;
    await pool.query(
      `INSERT INTO menu_config_audit_log
         (action, entity_type, entity_id, changed_by, branch_id, old_value, new_value, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
      [action, entityType, entityId, changedBy, branchId,
       oldValue ? JSON.stringify(oldValue) : null,
       newValue ? JSON.stringify(newValue) : null, ip]
    );
  } catch { /* non-critical */ }
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtGroup(row: Record<string, unknown>) {
  return {
    id:                    row.id,
    orgId:                 row.org_id,
    name:                  row.name,
    icon:                  row.icon ?? "🍽️",
    sortOrder:             row.sort_order,
    isActive:              row.is_active,
    taxRateOverride:       row.tax_rate_override != null ? parseFloat(row.tax_rate_override as string) : null,
    commissionDefaultRate: row.commission_default_rate != null ? parseFloat(row.commission_default_rate as string) : 0,
    commissionDefaultFlat: row.commission_default_flat != null ? parseFloat(row.commission_default_flat as string) : 0,
    notes:                 row.notes ?? null,
    updatedBy:             row.updated_by ?? null,
    updatedAt:             row.updated_at ?? null,
    createdAt:             row.created_at,
    typeCount:             parseInt(row.type_count as string ?? "0"),
    itemCount:             parseInt(row.item_count as string ?? "0"),
  };
}

function fmtType(row: Record<string, unknown>) {
  return {
    id:        row.id,
    groupId:   row.group_id,
    name:      row.name,
    sortOrder: row.sort_order,
    isActive:  row.is_active,
    createdAt: row.created_at,
    itemCount: parseInt(row.item_count as string ?? "0"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/menu-config/categories
router.get("/settings/menu-config/categories",
  authenticate,
  requireRole(...READ_ROLES),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT g.*,
               COUNT(DISTINCT t.id)::text   AS type_count,
               COUNT(DISTINCT p.id)::text   AS item_count
        FROM product_groups g
        LEFT JOIN product_types t ON t.group_id = g.id AND t.is_active = true
        LEFT JOIN products      p ON p.type_id  = t.id AND p.deleted_at IS NULL
        GROUP BY g.id
        ORDER BY g.sort_order, g.name
      `);
      res.json({ data: rows.map(fmtGroup) });
    } catch (err) {
      console.error("menu-config list categories:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /api/settings/menu-config/categories
router.post("/settings/menu-config/categories",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;
      const { rows } = await pool.query(`
        INSERT INTO product_groups
          (org_id, name, icon, sort_order, tax_rate_override,
           commission_default_rate, commission_default_flat, notes, updated_by, updated_at)
        VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9,NOW())
        RETURNING *
      `, [
        ORG_ID,
        JSON.stringify(b.name),
        b.icon ?? "🍽️",
        b.sortOrder ?? 0,
        b.taxRateOverride ?? null,
        b.commissionDefaultRate ?? 0,
        b.commissionDefaultFlat ?? 0,
        b.notes ?? null,
        req.user?.id ?? null,
      ]);
      const created = { ...fmtGroup(rows[0]), typeCount: 0, itemCount: 0 };
      void writeAudit("CATEGORY_CREATED", "product_group", rows[0].id as string,
        req.user?.id ?? null, null, null, created, req);
      res.status(201).json({ data: created });
    } catch (err) {
      console.error("menu-config create category:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PUT /api/settings/menu-config/categories/:id
router.put("/settings/menu-config/categories/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows: old } = await pool.query(
        `SELECT * FROM product_groups WHERE id=$1`, [id]);
      if (!old.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      const b = req.body as Record<string, unknown>;
      const { rows } = await pool.query(`
        UPDATE product_groups SET
          name                   = COALESCE($1::jsonb, name),
          icon                   = COALESCE($2, icon),
          sort_order             = COALESCE($3, sort_order),
          is_active              = COALESCE($4, is_active),
          tax_rate_override      = $5,
          commission_default_rate= COALESCE($6, commission_default_rate),
          commission_default_flat= COALESCE($7, commission_default_flat),
          notes                  = COALESCE($8, notes),
          updated_by             = $9,
          updated_at             = NOW()
        WHERE id=$10
        RETURNING *
      `, [
        b.name ? JSON.stringify(b.name) : null,
        b.icon ?? null,
        b.sortOrder ?? null,
        b.isActive !== undefined ? b.isActive : null,
        b.taxRateOverride !== undefined ? b.taxRateOverride : old[0].tax_rate_override,
        b.commissionDefaultRate ?? null,
        b.commissionDefaultFlat ?? null,
        b.notes ?? null,
        req.user?.id ?? null,
        id,
      ]);
      void writeAudit("CATEGORY_UPDATED", "product_group", id,
        req.user?.id ?? null, null, fmtGroup(old[0]), fmtGroup(rows[0]), req);
      res.json({ data: fmtGroup(rows[0]) });
    } catch (err) {
      console.error("menu-config update category:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /api/settings/menu-config/categories/:id  (soft delete)
router.delete("/settings/menu-config/categories/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `UPDATE product_groups SET is_active=false, updated_by=$1, updated_at=NOW()
         WHERE id=$2 RETURNING *`,
        [req.user?.id ?? null, id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      void writeAudit("CATEGORY_DEACTIVATED", "product_group", id,
        req.user?.id ?? null, null, null, { isActive: false }, req);
      res.json({ data: fmtGroup(rows[0]) });
    } catch (err) {
      console.error("menu-config delete category:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/settings/menu-config/categories/:id/sort
router.patch("/settings/menu-config/categories/:id/sort",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const b = req.body as { sortOrder: number };
      const { rows } = await pool.query(
        `UPDATE product_groups SET sort_order=$1, updated_by=$2, updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [b.sortOrder, req.user?.id ?? null, id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      void writeAudit("SORT_ORDER_CHANGED", "product_group", id,
        req.user?.id ?? null, null, null, { sortOrder: b.sortOrder }, req);
      res.json({ data: fmtGroup(rows[0]) });
    } catch (err) {
      console.error("menu-config sort category:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (sub-types within a category)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/menu-config/categories/:id/types
router.get("/settings/menu-config/categories/:id/types",
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT t.*,
               COUNT(p.id)::text AS item_count
        FROM product_types t
        LEFT JOIN products p ON p.type_id = t.id AND p.deleted_at IS NULL
        WHERE t.group_id = $1
        GROUP BY t.id
        ORDER BY t.sort_order, t.name
      `, [req.params.id]);
      res.json({ data: rows.map(fmtType) });
    } catch (err) {
      console.error("menu-config list types:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /api/settings/menu-config/categories/:id/types
router.post("/settings/menu-config/categories/:id/types",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;
      const { rows } = await pool.query(`
        INSERT INTO product_types (group_id, name, sort_order)
        VALUES ($1,$2::jsonb,$3)
        RETURNING *
      `, [req.params.id, JSON.stringify(b.name), b.sortOrder ?? 0]);
      void writeAudit("SUBTYPE_CREATED", "product_type", rows[0].id as string,
        req.user?.id ?? null, null, null, fmtType(rows[0]), req);
      res.status(201).json({ data: { ...fmtType(rows[0]), itemCount: 0 } });
    } catch (err) {
      console.error("menu-config create type:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PUT /api/settings/menu-config/types/:id
router.put("/settings/menu-config/types/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;
      const { rows } = await pool.query(`
        UPDATE product_types SET
          name       = COALESCE($1::jsonb, name),
          sort_order = COALESCE($2, sort_order),
          is_active  = COALESCE($3, is_active)
        WHERE id=$4
        RETURNING *
      `, [
        b.name ? JSON.stringify(b.name) : null,
        b.sortOrder ?? null,
        b.isActive !== undefined ? b.isActive : null,
        req.params.id,
      ]);
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      void writeAudit("SUBTYPE_UPDATED", "product_type", req.params.id,
        req.user?.id ?? null, null, null, fmtType(rows[0]), req);
      res.json({ data: fmtType(rows[0]) });
    } catch (err) {
      console.error("menu-config update type:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /api/settings/menu-config/types/:id  (soft delete)
router.delete("/settings/menu-config/types/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE product_types SET is_active=false WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      void writeAudit("SUBTYPE_DEACTIVATED", "product_type", req.params.id,
        req.user?.id ?? null, null, null, { isActive: false }, req);
      res.json({ data: fmtType(rows[0]) });
    } catch (err) {
      console.error("menu-config delete type:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/menu-config/categories/:id/branch-overrides
router.get("/settings/menu-config/categories/:id/branch-overrides",
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT b.id, b.name AS branch_name,
               COALESCE(o.is_visible, true)              AS is_visible,
               o.sort_order_override,
               o.id                                      AS override_id
        FROM branches b
        LEFT JOIN product_group_branch_overrides o
          ON o.branch_id = b.id AND o.product_group_id = $1
        ORDER BY b.name
      `, [req.params.id]);
      res.json({
        data: rows.map((r) => ({
          branchId:          r.id,
          branchName:        r.branch_name,
          isVisible:         r.is_visible,
          sortOrderOverride: r.sort_order_override ?? null,
          overrideId:        r.override_id ?? null,
        })),
      });
    } catch (err) {
      console.error("menu-config branch overrides:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/settings/menu-config/branch-overrides?branch_id=UUID
// Returns ALL categories with their visibility status for a specific branch
router.get("/settings/menu-config/branch-overrides",
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id } = req.query as Record<string, string>;

      // branch_manager can only query their own branch
      if (req.user?.role === ROLES.BRANCH_MANAGER && branch_id !== req.user?.branchId) {
        res.status(403).json({ error: "BRANCH_ACCESS_DENIED", message: "You can only view overrides for your own branch." });
        return;
      }

      if (!branch_id) {
        res.status(400).json({ error: "BRANCH_ID_REQUIRED", message: "branch_id query parameter is required." });
        return;
      }

      const { rows } = await pool.query(`
        SELECT
          g.id,
          g.name,
          g.icon,
          g.sort_order,
          g.is_active                                        AS global_is_active,
          COALESCE(o.is_visible, g.is_active)                AS effective_visible,
          o.is_visible                                       AS override_is_visible,
          o.sort_order_override,
          o.id                                               AS override_id,
          o.updated_at                                       AS override_updated_at,
          COUNT(DISTINCT t.id)::text                         AS type_count,
          COUNT(DISTINCT p.id)::text                         AS item_count
        FROM product_groups g
        LEFT JOIN product_group_branch_overrides o
          ON o.product_group_id = g.id AND o.branch_id = $1
        LEFT JOIN product_types t ON t.group_id = g.id AND t.is_active = true
        LEFT JOIN products      p ON p.type_id  = t.id AND p.deleted_at IS NULL
        GROUP BY g.id, o.id
        ORDER BY g.sort_order, g.name
      `, [branch_id]);

      res.json({
        data: rows.map((r) => ({
          id:                 r.id,
          name:               r.name,
          icon:               r.icon ?? "🍽️",
          sortOrder:          r.sort_order,
          globalIsActive:     r.global_is_active,
          effectiveVisible:   r.effective_visible,
          overrideIsVisible:  r.override_is_visible,   // null = no override
          hasOverride:        r.override_id !== null,
          overrideId:         r.override_id,
          sortOrderOverride:  r.sort_order_override,
          overrideUpdatedAt:  r.override_updated_at,
          typeCount:          parseInt(r.type_count ?? "0"),
          itemCount:          parseInt(r.item_count ?? "0"),
        })),
      });
    } catch (err) {
      console.error("menu-config branch-overrides GET:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/settings/menu-config/branch-override  (upsert)
// Admin: any branch | branch_manager: own branch only
router.patch("/settings/menu-config/branch-override",
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;

      // branch_manager can only manage their own branch
      if (req.user?.role === ROLES.BRANCH_MANAGER) {
        if (b.branchId !== req.user?.branchId) {
          res.status(403).json({ error: "BRANCH_ACCESS_DENIED", message: "You can only manage overrides for your own branch." });
          return;
        }
      } else if (![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user?.role as string)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
      }

      const { rows } = await pool.query(`
        INSERT INTO product_group_branch_overrides
          (product_group_id, branch_id, is_visible, sort_order_override, updated_by, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW())
        ON CONFLICT (product_group_id, branch_id) DO UPDATE SET
          is_visible         = EXCLUDED.is_visible,
          sort_order_override= EXCLUDED.sort_order_override,
          updated_by         = EXCLUDED.updated_by,
          updated_at         = NOW()
        RETURNING *
      `, [b.productGroupId, b.branchId, b.isVisible ?? true,
          b.sortOrderOverride ?? null, req.user?.id ?? null]);

      void writeAudit("BRANCH_VISIBILITY_CHANGED", "product_group",
        b.productGroupId as string, req.user?.id ?? null,
        b.branchId as string, null, { isVisible: b.isVisible }, req);
      res.json({ data: rows[0] });
    } catch (err) {
      console.error("menu-config branch override upsert:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /api/settings/menu-config/branch-override  (reset to global default)
router.delete("/settings/menu-config/branch-override",
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;

      if (req.user?.role === ROLES.BRANCH_MANAGER && b.branchId !== req.user?.branchId) {
        res.status(403).json({ error: "BRANCH_ACCESS_DENIED" });
        return;
      } else if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER].includes(req.user?.role as string)) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
      }

      await pool.query(
        `DELETE FROM product_group_branch_overrides
         WHERE product_group_id=$1 AND branch_id=$2`,
        [b.productGroupId, b.branchId]
      );

      void writeAudit("BRANCH_OVERRIDE_RESET", "product_group",
        b.productGroupId as string, req.user?.id ?? null,
        b.branchId as string, null, { reset: true }, req);

      res.json({ success: true });
    } catch (err) {
      console.error("menu-config branch override delete:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/settings/menu-config/audit-log
router.get("/settings/menu-config/audit-log",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string ?? "50");
      const { rows } = await pool.query(`
        SELECT l.*, s.name AS changed_by_name
        FROM menu_config_audit_log l
        LEFT JOIN staff s ON s.id = l.changed_by
        ORDER BY l.created_at DESC
        LIMIT $1
      `, [limit]);
      res.json({ data: rows });
    } catch (err) {
      console.error("menu-config audit log:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
