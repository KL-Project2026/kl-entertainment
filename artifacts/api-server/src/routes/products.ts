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

// Product Groups
router.get(
  "/products/groups",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM product_groups WHERE is_active = true ORDER BY sort_order, id`
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
         SET name = COALESCE($1::jsonb, name),
             sku = COALESCE($2, sku),
             unit_price = COALESCE($3, unit_price),
             unit = COALESCE($4, unit),
             tax_applicable = COALESCE($5, tax_applicable),
             sort_order = COALESCE($6, sort_order),
             is_active = COALESCE($7, is_active)
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING *`,
        [body.name ? JSON.stringify(body.name) : null,
         body.sku, body.unitPrice, body.unit, body.taxApplicable,
         body.sortOrder, body.isActive, req.params.id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
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
