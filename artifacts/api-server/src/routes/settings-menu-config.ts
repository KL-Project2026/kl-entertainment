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
    id:                      row.id,
    orgId:                   row.org_id,
    name:                    row.name,
    icon:                    row.icon ?? "🍽️",
    sortOrder:               row.sort_order,
    isActive:                row.is_active,
    taxRateOverride:         row.tax_rate_override != null ? parseFloat(row.tax_rate_override as string) : null,
    commissionDefaultRate:   row.commission_default_rate != null ? parseFloat(row.commission_default_rate as string) : 0,
    commissionDefaultFlat:   row.commission_default_flat != null ? parseFloat(row.commission_default_flat as string) : 0,
    notes:                   row.notes ?? null,
    updatedBy:               row.updated_by ?? null,
    updatedAt:               row.updated_at ?? null,
    createdAt:               row.created_at,
    typeCount:               parseInt(row.type_count as string ?? "0"),
    itemCount:               parseInt(row.item_count as string ?? "0"),
    menuCategoryId:          row.menu_category_id ?? null,
    menuCatName:             row.menu_cat_name ?? null,
    menuCatVisibilityLevel:  row.menu_cat_visibility_level ?? null,
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
               COUNT(DISTINCT p.id)::text   AS item_count,
               mc.name                      AS menu_cat_name,
               mc.visibility_level          AS menu_cat_visibility_level
        FROM product_groups g
        LEFT JOIN product_types t  ON t.group_id = g.id AND t.is_active = true
        LEFT JOIN products      p  ON p.type_id  = t.id AND p.deleted_at IS NULL
        LEFT JOIN menu_categories mc ON mc.id = g.menu_category_id
        GROUP BY g.id, mc.name, mc.visibility_level
        ORDER BY g.sort_order, g.name
      `);
      res.json({ data: rows.map(fmtGroup) });
    } catch (err) {
      console.error("menu-config list categories:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── Shared validation helper ──────────────────────────────────────────────────
interface CatBody {
  name?: unknown;
  icon?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
  taxRateOverride?: unknown;
  commissionDefaultRate?: unknown;
  commissionDefaultFlat?: unknown;
  notes?: unknown;
  menuCategoryId?: unknown;
}

async function validateCatBody(
  b: CatBody,
  opts: { isUpdate: boolean; existingId?: string; existingName?: unknown }
): Promise<{ error: string; message: string; status: number } | null> {
  // Name: required on create, optional on update
  if (!opts.isUpdate && !b.name) {
    return { error: "VALIDATION_ERROR", message: "name is required.", status: 400 };
  }

  // Name uniqueness: compare by English name value (name->>'en') to handle multilingual JSONB
  if (b.name !== undefined && typeof b.name === "object" && b.name !== null) {
    const enName = (b.name as Record<string, string>).en;
    if (enName) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM product_groups WHERE name->>'en' ILIKE $1 AND id != $2`,
        [enName.trim(), opts.existingId ?? "00000000-0000-0000-0000-000000000000"]
      );
      if (dup.length) {
        return {
          error: "CATEGORY_NAME_DUPLICATE",
          message: `A category with the name "${enName}" already exists.`,
          status: 409,
        };
      }
    }
  }

  // Tax rate: must be 0–1 if provided
  if (b.taxRateOverride !== null && b.taxRateOverride !== undefined) {
    const rate = Number(b.taxRateOverride);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return {
        error: "INVALID_TAX_RATE",
        message: "Tax rate must be between 0 and 1 (e.g. 0.06 for 6%).",
        status: 400,
      };
    }
  }

  // Commission: cannot set both rate > 0 AND flat > 0
  const rate = Number(b.commissionDefaultRate ?? 0);
  const flat  = Number(b.commissionDefaultFlat  ?? 0);
  if (rate > 0 && flat > 0) {
    return {
      error: "INVALID_COMMISSION",
      message: "Set either a percentage rate or a flat amount, not both.",
      status: 400,
    };
  }

  return null;
}

// POST /api/settings/menu-config/categories
router.post("/settings/menu-config/categories",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as CatBody;
      const validationErr = await validateCatBody(b, { isUpdate: false });
      if (validationErr) {
        res.status(validationErr.status).json({ error: validationErr.error, message: validationErr.message });
        return;
      }

      const { rows } = await pool.query(`
        INSERT INTO product_groups
          (org_id, name, icon, sort_order, tax_rate_override,
           commission_default_rate, commission_default_flat, notes,
           menu_category_id, updated_by, updated_at)
        VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
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
        b.menuCategoryId ?? null,
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

      const b = req.body as CatBody;
      const validationErr = await validateCatBody(b, {
        isUpdate: true,
        existingId: id,
        existingName: old[0].name,
      });
      if (validationErr) {
        res.status(validationErr.status).json({ error: validationErr.error, message: validationErr.message });
        return;
      }

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
          menu_category_id       = $9,
          updated_by             = $10,
          updated_at             = NOW()
        WHERE id=$11
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
        b.menuCategoryId !== undefined ? (b.menuCategoryId || null) : old[0].menu_category_id,
        req.user?.id ?? null,
        id,
      ]);
      // Re-fetch with JOIN to include menuCatName / menuCatVisibilityLevel
      const { rows: full } = await pool.query(`
        SELECT g.*, mc.name AS menu_cat_name, mc.visibility_level AS menu_cat_visibility_level
        FROM product_groups g
        LEFT JOIN menu_categories mc ON mc.id = g.menu_category_id
        WHERE g.id = $1
      `, [id]);
      void writeAudit("CATEGORY_UPDATED", "product_group", id,
        req.user?.id ?? null, null, fmtGroup(old[0]), fmtGroup(rows[0]), req);
      res.json({ data: fmtGroup(full[0] ?? rows[0]) });
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

      // Verify category exists
      const { rows: existing } = await pool.query(
        `SELECT * FROM product_groups WHERE id=$1`, [id]);
      if (!existing.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      // Block deactivation if category has active items (direct or via sub-types)
      const { rows: itemCheck } = await pool.query(`
        SELECT COUNT(p.id)::int AS item_count
        FROM products p
        WHERE p.deleted_at IS NULL
          AND p.type_id IN (
            SELECT t.id FROM product_types t WHERE t.group_id = $1
          )
      `, [id]);
      const itemCount = itemCheck[0]?.item_count ?? 0;
      if (itemCount > 0) {
        res.status(409).json({
          error: "CATEGORY_HAS_ITEMS",
          itemCount,
          message: `Cannot hide this category — it has ${itemCount} active item(s). Move or deactivate items first.`,
        });
        return;
      }

      const { rows } = await pool.query(
        `UPDATE product_groups SET is_active=false, updated_by=$1, updated_at=NOW()
         WHERE id=$2 RETURNING *`,
        [req.user?.id ?? null, id]
      );
      void writeAudit("CATEGORY_DEACTIVATED", "product_group", id,
        req.user?.id ?? null, null, fmtGroup(existing[0]), { isActive: false }, req);
      res.json({ data: fmtGroup(rows[0]) });
    } catch (err) {
      console.error("menu-config delete category:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/settings/menu-config/categories/reorder  (bulk)
// NOTE: registered before /:id/sort to avoid Express param collision on 'reorder'
// Body: { order: [ { id: UUID, sortOrder: INT }, ... ] }
router.patch("/settings/menu-config/categories/reorder",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { order } = req.body as { order: { id: string; sortOrder: number }[] };
      if (!Array.isArray(order) || !order.length) {
        res.status(400).json({ error: "VALIDATION_ERROR", message: "order array is required." });
        return;
      }

      // Verify all IDs exist
      const ids = order.map((o) => o.id);
      const { rows: existing } = await pool.query(
        `SELECT id FROM product_groups WHERE id = ANY($1::uuid[])`, [ids]);
      if (existing.length !== ids.length) {
        res.status(400).json({ error: "INVALID_IDS", message: "One or more category IDs not found." });
        return;
      }

      // Apply bulk update in a transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const { id, sortOrder } of order) {
          await client.query(
            `UPDATE product_groups SET sort_order=$1, updated_by=$2, updated_at=NOW() WHERE id=$3`,
            [sortOrder, req.user?.id ?? null, id]
          );
        }
        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }

      void writeAudit("SORT_ORDER_CHANGED", "product_group", "bulk",
        req.user?.id ?? null, null, null,
        { order: order.map((o) => ({ id: o.id, sortOrder: o.sortOrder })) }, req);
      res.json({ success: true, updated: order.length });
    } catch (err) {
      console.error("menu-config bulk reorder:", err);
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
      const groupId = req.params.id;

      if (!b.name) {
        res.status(400).json({ error: "VALIDATION_ERROR", message: "name is required." });
        return;
      }

      // Sub-type name uniqueness within same group — compare by English name
      const nameJson = JSON.stringify(b.name);
      const enName = typeof b.name === "object" && b.name !== null
        ? (b.name as Record<string, string>).en : null;
      if (enName) {
        const { rows: dup } = await pool.query(
          `SELECT id FROM product_types WHERE group_id=$1 AND name->>'en' ILIKE $2`,
          [groupId, enName.trim()]
        );
        if (dup.length) {
          res.status(409).json({
            error: "SUBTYPE_NAME_DUPLICATE",
            message: `A sub-type named "${enName}" already exists in this category.`,
          });
          return;
        }
      }

      const { rows } = await pool.query(`
        INSERT INTO product_types (group_id, name, sort_order)
        VALUES ($1,$2::jsonb,$3)
        RETURNING *
      `, [groupId, nameJson, b.sortOrder ?? 0]);
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
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;

      // Snapshot old value for audit
      const { rows: old } = await pool.query(
        `SELECT * FROM product_types WHERE id=$1`, [id]);
      if (!old.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      // Name uniqueness within same group — only if name is changing (compare en key)
      if (b.name !== undefined) {
        const newEn = typeof b.name === "object" && b.name !== null
          ? (b.name as Record<string, string>).en?.trim() : null;
        const oldEn = old[0].name?.en;
        if (newEn && newEn.toLowerCase() !== (oldEn ?? "").toLowerCase()) {
          const { rows: dup } = await pool.query(
            `SELECT id FROM product_types WHERE group_id=$1 AND name->>'en' ILIKE $2 AND id != $3`,
            [old[0].group_id, newEn, id]
          );
          if (dup.length) {
            res.status(409).json({
              error: "SUBTYPE_NAME_DUPLICATE",
              message: `A sub-type named "${newEn}" already exists in this category.`,
            });
            return;
          }
        }
      }

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
        id,
      ]);
      void writeAudit("SUBTYPE_UPDATED", "product_type", id,
        req.user?.id ?? null, null, fmtType(old[0]), fmtType(rows[0]), req);
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
      const { id } = req.params;

      const { rows: existing } = await pool.query(
        `SELECT * FROM product_types WHERE id=$1`, [id]);
      if (!existing.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }

      // Block if active items reference this sub-type
      const { rows: itemCheck } = await pool.query(
        `SELECT COUNT(id)::int AS item_count FROM products WHERE type_id=$1 AND deleted_at IS NULL`,
        [id]
      );
      const itemCount = itemCheck[0]?.item_count ?? 0;
      if (itemCount > 0) {
        res.status(409).json({
          error: "SUBTYPE_HAS_ITEMS",
          itemCount,
          message: `Cannot deactivate this sub-type — it has ${itemCount} active item(s). Move or deactivate items first.`,
        });
        return;
      }

      const { rows } = await pool.query(
        `UPDATE product_types SET is_active=false WHERE id=$1 RETURNING *`,
        [id]
      );
      void writeAudit("SUBTYPE_DEACTIVATED", "product_type", id,
        req.user?.id ?? null, null, fmtType(existing[0]), { isActive: false }, req);
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
// ?entity_id=UUID  optional — filter by specific category/type
// ?action=string   optional — filter by action type
// ?limit=50        default 50, max 200
// ?offset=0        default 0
router.get("/settings/menu-config/audit-log",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const limit  = Math.min(parseInt(q.limit  ?? "50"),  200);
      const offset = parseInt(q.offset ?? "0");
      const entityId = q.entity_id ?? null;
      const action   = q.action    ?? null;

      const params: unknown[] = [];
      const conds: string[] = [];

      if (entityId) { params.push(entityId); conds.push(`l.entity_id = $${params.length}`); }
      if (action)   { params.push(action);   conds.push(`l.action    = $${params.length}`); }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

      // Count total for pagination
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM menu_config_audit_log l ${where}`,
        params
      );
      const total = countRes.rows[0].total as number;

      params.push(limit);  const limitIdx  = params.length;
      params.push(offset); const offsetIdx = params.length;

      const { rows } = await pool.query(`
        SELECT
          l.*,
          s.full_name                                              AS changed_by_name,
          s.role                                                   AS changed_by_role,
          -- look up entity name from both possible tables
          COALESCE(
            (SELECT pg.name FROM product_groups pg WHERE pg.id = l.entity_id),
            (SELECT pt.name FROM product_types  pt WHERE pt.id = l.entity_id)
          )                                                        AS entity_name,
          b.name                                                   AS branch_name
        FROM menu_config_audit_log l
        LEFT JOIN staff    s ON s.id = l.changed_by
        LEFT JOIN branches b ON b.id = l.branch_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, params);

      res.json({
        data: rows.map((r) => ({
          id:            r.id,
          action:        r.action,
          entityType:    r.entity_type,
          entityId:      r.entity_id,
          entityName:    r.entity_name ?? null,
          branchId:      r.branch_id ?? null,
          branchName:    r.branch_name ?? null,
          changedBy:     r.changed_by,
          changedByName: r.changed_by_name ?? "System",
          changedByRole: r.changed_by_role ?? null,
          oldValue:      r.old_value ?? null,
          newValue:      r.new_value ?? null,
          ipAddress:     r.ip_address ?? null,
          createdAt:     r.created_at,
        })),
        pagination: { total, limit, offset },
      });
    } catch (err) {
      console.error("menu-config audit log:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// GET /api/settings/menu-config/audit-log/actions
// Returns distinct action types for filter dropdown
router.get("/settings/menu-config/audit-log/actions",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT action FROM menu_config_audit_log ORDER BY action`
      );
      res.json({ data: rows.map((r) => r.action as string) });
    } catch (err) {
      console.error("menu-config audit actions:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// MENU CATEGORIES (role-based visibility for Operations → Menu page)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/settings/menu-config/menu-categories
router.get("/settings/menu-config/menu-categories",
  authenticate,
  requireRole(...READ_ROLES),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT mc.*,
                COUNT(mi.id) FILTER (WHERE mi.is_available AND NOT mi.is_deleted) AS item_count
         FROM menu_categories mc
         LEFT JOIN menu_items mi ON mi.category_id = mc.id
         WHERE mc.org_id = $1
         GROUP BY mc.id
         ORDER BY mc.sort_order, mc.name`,
        [ORG_ID]
      );
      res.json({
        data: rows.map((r) => ({
          id:                 r.id,
          name:               r.name,
          description:        r.description ?? null,
          sortOrder:          r.sort_order,
          isActive:           r.is_active,
          visibilityLevel:    r.visibility_level,
          invoiceDisplayMode: r.invoice_display_mode,
          invoiceAlias:       r.invoice_alias ?? null,
          itemCount:          parseInt(r.item_count ?? "0"),
          createdAt:          r.created_at,
        })),
      });
    } catch (err) {
      console.error("menu-categories list:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// POST /api/settings/menu-config/menu-categories
router.post("/settings/menu-config/menu-categories",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    const { name, description, visibilityLevel, invoiceDisplayMode, invoiceAlias } = req.body as Record<string, string>;
    if (!name?.trim()) { res.status(400).json({ error: "NAME_REQUIRED", message: "Name is required" }); return; }
    const vis  = ["ALL","MANAGER_ONLY","ADMIN_ONLY"].includes(visibilityLevel) ? visibilityLevel : "ALL";
    const disp = ["REAL_NAME","MASKED_CODE","MASKED_SYMBOL","CUSTOM_ALIAS"].includes(invoiceDisplayMode) ? invoiceDisplayMode : "REAL_NAME";
    try {
      const { rows } = await pool.query(
        `INSERT INTO menu_categories (org_id, name, description, visibility_level, invoice_display_mode, invoice_alias)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [ORG_ID, name.trim(), description?.trim() || null, vis, disp, disp === "CUSTOM_ALIAS" ? (invoiceAlias?.trim() || null) : null]
      );
      const r = rows[0];
      await writeAudit("MENU_CAT_CREATED", "menu_category", r.id, (req as Request & { user?: { id: string } }).user?.id ?? null, null, null, {
        name: r.name, visibilityLevel: r.visibility_level, invoiceDisplayMode: r.invoice_display_mode,
      }, req);
      res.status(201).json({ data: { id: r.id, name: r.name } });
    } catch (err) {
      console.error("menu-categories create:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// PATCH /api/settings/menu-config/menu-categories/:id
router.patch("/settings/menu-config/menu-categories/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description, visibilityLevel, invoiceDisplayMode, invoiceAlias, isActive, sortOrder } = req.body as Record<string, unknown>;
    try {
      const { rows: existing } = await pool.query(
        `SELECT * FROM menu_categories WHERE id=$1 AND org_id=$2`, [id, ORG_ID]
      );
      if (!existing.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const old = existing[0];

      const sets: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      function add(col: string, val: unknown) { sets.push(`${col}=$${p++}`); params.push(val); }

      if (name !== undefined && typeof name === "string" && name.trim()) add("name", name.trim());
      if (description !== undefined) add("description", typeof description === "string" && description.trim() ? description.trim() : null);
      if (visibilityLevel !== undefined && ["ALL","MANAGER_ONLY","ADMIN_ONLY"].includes(String(visibilityLevel))) add("visibility_level", visibilityLevel);
      if (invoiceDisplayMode !== undefined && ["REAL_NAME","MASKED_CODE","MASKED_SYMBOL","CUSTOM_ALIAS"].includes(String(invoiceDisplayMode))) {
        add("invoice_display_mode", invoiceDisplayMode);
        const alias = String(invoiceDisplayMode) === "CUSTOM_ALIAS" ? (typeof invoiceAlias === "string" ? invoiceAlias.trim() || null : null) : null;
        add("invoice_alias", alias);
      }
      if (isActive !== undefined) add("is_active", Boolean(isActive));
      if (sortOrder !== undefined && !isNaN(Number(sortOrder))) add("sort_order", Number(sortOrder));

      if (!sets.length) { res.json({ data: { id } }); return; }
      params.push(id);
      const { rows } = await pool.query(
        `UPDATE menu_categories SET ${sets.join(",")} WHERE id=$${p} RETURNING *`, params
      );
      const r = rows[0];
      await writeAudit("MENU_CAT_UPDATED", "menu_category", id, (req as Request & { user?: { id: string } }).user?.id ?? null, null,
        { name: old.name, visibilityLevel: old.visibility_level, invoiceDisplayMode: old.invoice_display_mode, isActive: old.is_active },
        { name: r.name,   visibilityLevel: r.visibility_level,   invoiceDisplayMode: r.invoice_display_mode,   isActive: r.is_active },
        req
      );
      res.json({ data: { id: r.id } });
    } catch (err) {
      console.error("menu-categories patch:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// DELETE /api/settings/menu-config/menu-categories/:id
router.delete("/settings/menu-config/menu-categories/:id",
  authenticate,
  requireRole(...ADMIN_ONLY),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT mc.*, COUNT(mi.id) FILTER (WHERE mi.is_available AND NOT mi.is_deleted) AS item_count
         FROM menu_categories mc LEFT JOIN menu_items mi ON mi.category_id=mc.id
         WHERE mc.id=$1 AND mc.org_id=$2 GROUP BY mc.id`, [id, ORG_ID]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const count = parseInt(rows[0].item_count ?? "0");
      if (count > 0) { res.status(409).json({ error: "CATEGORY_HAS_ITEMS", itemCount: count, message: `Category has ${count} active item(s). Deactivate items first.` }); return; }
      await pool.query(`UPDATE menu_categories SET is_active=false WHERE id=$1`, [id]);
      await writeAudit("MENU_CAT_DELETED", "menu_category", id, (req as Request & { user?: { id: string } }).user?.id ?? null, null,
        { name: rows[0].name }, { isActive: false }, req
      );
      res.json({ data: { id } });
    } catch (err) {
      console.error("menu-categories delete:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;

