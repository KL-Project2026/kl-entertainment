import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

function getLang(req: Request): string {
  const acceptLang = req.headers["accept-language"];
  return acceptLang?.split(",")[0]?.split("-")[0] ?? "en";
}

const MANAGER_ROLES = new Set([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.MANAGER]);
const ADMIN_ROLES   = new Set([ROLES.SUPER_ADMIN, ROLES.ADMIN]);

// Product Groups
router.get(
  "/products/groups",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role = req.user?.role ?? "";
      let visFilter: string;
      if (ADMIN_ROLES.has(role)) {
        visFilter = "";
      } else if (MANAGER_ROLES.has(role)) {
        visFilter = `AND (mc.visibility_level IS NULL OR mc.visibility_level IN ('ALL','MANAGER_ONLY'))`;
      } else {
        visFilter = `AND (mc.visibility_level IS NULL OR mc.visibility_level = 'ALL')`;
      }

      const { rows } = await pool.query(
        `SELECT pg.*
         FROM product_groups pg
         LEFT JOIN menu_categories mc ON mc.id = pg.menu_category_id
         WHERE pg.is_active = true ${visFilter}
         ORDER BY pg.sort_order, pg.id`
      );
      res.json({ data: rows.map(formatGroup) });
    } catch (err) {
      console.error("List product groups error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.post(
  "/products/groups",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO product_groups (org_id, name, sort_order) VALUES ($1, $2::jsonb, $3) RETURNING *`,
        [body.orgId, JSON.stringify(body.name), body.sortOrder ?? 0]
      );
      res.status(201).json({ data: formatGroup(rows[0]) });
    } catch (err) {
      console.error("Create product group error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Product Types
router.get(
  "/products/types",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = req.query.group_id as string | undefined;
      const { rows } = groupId
        ? await pool.query(
            `SELECT * FROM product_types WHERE group_id = $1 AND is_active = true ORDER BY sort_order`,
            [groupId]
          )
        : await pool.query(
            `SELECT * FROM product_types WHERE is_active = true ORDER BY sort_order`
          );
      res.json({ data: rows.map(formatType) });
    } catch (err) {
      console.error("List product types error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.post(
  "/products/types",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO product_types (group_id, name, sort_order) VALUES ($1, $2::jsonb, $3) RETURNING *`,
        [body.groupId, JSON.stringify(body.name), body.sortOrder ?? 0]
      );
      res.status(201).json({ data: formatType(rows[0]) });
    } catch (err) {
      console.error("Create product type error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Single product
router.get(
  "/products/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT p.*,
                pt.name   AS type_name,
                pg.id     AS group_id,
                pg.name   AS group_name,
                b.name    AS branch_name
         FROM products p
         LEFT JOIN product_types  pt ON p.type_id    = pt.id
         LEFT JOIN product_groups pg ON pt.group_id   = pg.id
         LEFT JOIN branches        b ON p.branch_id   = b.id
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [req.params.id]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const lang = getLang(req);
      res.json({ data: formatProductDetail(rows[0], lang) });
    } catch (err) {
      console.error("Get product error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// Products
router.get(
  "/products",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { branch_id, type_id } = req.query as Record<string, string>;

      let query = `SELECT p.* FROM products p WHERE p.is_active = true AND p.deleted_at IS NULL`;
      const params: string[] = [];

      if (type_id) {
        params.push(type_id);
        query += ` AND p.type_id = $${params.length}`;
      }
      if (branch_id) {
        params.push(branch_id);
        query += ` AND (p.branch_id = $${params.length} OR p.branch_id IS NULL)`;
      }
      query += ` ORDER BY p.sort_order, p.id`;

      const { rows } = await pool.query(query, params);
      const lang = getLang(req);
      res.json({ data: rows.map((r) => formatProduct(r, lang)) });
    } catch (err) {
      console.error("List products error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.post(
  "/products",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `INSERT INTO products (type_id, branch_id, sku, name, description, unit_price, unit, tax_applicable, sort_order)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
         RETURNING *`,
        [body.typeId, body.branchId ?? null, body.sku ?? null,
         JSON.stringify(body.name), body.description ? JSON.stringify(body.description) : null,
         body.unitPrice, body.unit ?? "pcs", body.taxApplicable !== false, body.sortOrder ?? 0]
      );
      const lang = getLang(req);
      res.status(201).json({ data: formatProduct(rows[0], lang) });
    } catch (err) {
      console.error("Create product error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.put(
  "/products/:id",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const { rows } = await pool.query(
        `UPDATE products
         SET name          = COALESCE($1::jsonb, name),
             description   = COALESCE($2::jsonb, description),
             sku           = COALESCE($3, sku),
             unit_price    = COALESCE($4, unit_price),
             unit          = COALESCE($5, unit),
             tax_applicable= COALESCE($6, tax_applicable),
             sort_order    = COALESCE($7, sort_order),
             is_active     = COALESCE($8, is_active)
         WHERE id = $9 AND deleted_at IS NULL
         RETURNING *`,
        [
          body.name        ? JSON.stringify(body.name)        : null,
          body.description ? JSON.stringify(body.description) : null,
          body.sku        ?? null,
          body.unitPrice  ?? null,
          body.unit       ?? null,
          body.taxApplicable !== undefined ? body.taxApplicable : null,
          body.sortOrder  ?? null,
          body.isActive   !== undefined ? body.isActive : null,
          req.params.id,
        ]
      );
      if (!rows.length) { res.status(404).json({ error: "NOT_FOUND" }); return; }
      const lang = getLang(req);
      res.json({ data: formatProduct(rows[0], lang) });
    } catch (err) {
      console.error("Update product error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

router.put(
  "/products/:id/toggle",
  authenticate,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `UPDATE products SET is_active = NOT is_active WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      const lang = getLang(req);
      res.json({ data: formatProduct(rows[0], lang) });
    } catch (err) {
      console.error("Toggle product error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

function formatGroup(row: Record<string, unknown>) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function formatType(row: Record<string, unknown>) {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function formatProductDetail(row: Record<string, unknown>, lang: string) {
  const base = formatProduct(row, lang);
  const typeName  = row.type_name  as Record<string, string> | null;
  const groupName = row.group_name as Record<string, string> | null;
  return {
    ...base,
    typeId:      row.type_id   ?? null,
    typeName:    typeName  ? (typeName[lang]  ?? typeName["en"]  ?? "") : null,
    groupId:     row.group_id  ?? null,
    groupName:   groupName ? (groupName[lang] ?? groupName["en"] ?? "") : null,
    branchName:  row.branch_name ?? null,
    description: row.description ?? null,
  };
}

function formatProduct(row: Record<string, unknown>, lang: string) {
  const nameObj = row.name as Record<string, string>;
  return {
    id: row.id,
    typeId: row.type_id,
    branchId: row.branch_id ?? null,
    sku: row.sku ?? null,
    name: nameObj,
    nameLocalized: nameObj[lang] ?? nameObj["en"] ?? "",
    description: row.description ?? null,
    unitPrice: parseFloat(row.unit_price as string),
    unit: row.unit,
    taxApplicable: row.tax_applicable,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export default router;
