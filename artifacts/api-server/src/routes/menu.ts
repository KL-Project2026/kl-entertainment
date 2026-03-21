// MIGRATION: convert to EF Core repository pattern

import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { ROLES } from "../config/constants";

const router: IRouter = Router();

// Roles that see the full menu (manager and above)
const managerAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
);

// All operational staff (includes kitchen/hall/general)
const allStaffAccess = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.BRANCH_MANAGER,
  ROLES.MANAGER,
  ROLES.KITCHEN,
  ROLES.HALL,
  ROLES.GENERAL,
);

const STAFF_ROLES = new Set<string>([ROLES.KITCHEN, ROLES.HALL, ROLES.GENERAL]);

// ── GET /menu/standard ────────────────────────────────────────────────────────
// MIGRATION: convert to EF Core repository pattern
router.get(
  "/menu/standard",
  authenticate,
  allStaffAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role    = req.user!.role;
      const isStaff = STAFF_ROLES.has(role);

      // Staff see only ALL-visibility categories; managers see everything
      const visibilityFilter = isStaff
        ? `AND mc.visibility_level = 'ALL'`
        : "";

      const { rows: categories } = await pool.query<{
        id: string; name: string; description: string | null;
        sort_order: number; is_active: boolean;
        visibility_level: string; invoice_display_mode: string;
        invoice_alias: string | null;
      }>(
        `SELECT mc.id, mc.name, mc.description, mc.sort_order, mc.is_active,
                mc.visibility_level, mc.invoice_display_mode, mc.invoice_alias
         FROM menu_categories mc
         WHERE mc.is_active = true
           ${visibilityFilter}
         ORDER BY mc.sort_order, mc.name`
      );

      const { rows: items } = await pool.query<{
        id: string; category_id: string; product_id: string | null;
        name: string; description: string | null;
        unit_price: string; is_available: boolean; sort_order: number;
      }>(
        `SELECT mi.id, mi.category_id, mi.product_id, mi.name, mi.description,
                mi.unit_price, mi.is_available, mi.sort_order
         FROM menu_items mi
         JOIN menu_categories mc ON mc.id = mi.category_id
         WHERE mi.is_deleted = false
           AND mi.is_available = true
           AND mc.is_active = true
           ${visibilityFilter}
         ORDER BY mi.sort_order, mi.name`
      );

      // Group items under categories
      const itemsByCategory: Record<string, typeof items> = {};
      for (const item of items) {
        if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = [];
        itemsByCategory[item.category_id].push(item);
      }

      const result = categories.map(cat => ({
        ...cat,
        unit_price: undefined,
        items: (itemsByCategory[cat.id] ?? []).map(i => ({
          id:          i.id,
          category_id: i.category_id,
          product_id:  i.product_id,
          name:        i.name,
          description: i.description,
          unit_price:  parseFloat(i.unit_price),
          is_available: i.is_available,
          sort_order:  i.sort_order,
        })),
      }));

      res.json({
        menuType:   isStaff ? "STANDARD" : "FULL",
        categories: result,
      });
    } catch (err) {
      console.error("[Menu] /menu/standard error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

// ── GET /menu/manager ─────────────────────────────────────────────────────────
// Returns ALL categories including MANAGER_ONLY and ADMIN_ONLY.
// Includes invoice_display_mode and invoice_alias for manager configuration.
// MIGRATION: convert to EF Core repository pattern
router.get(
  "/menu/manager",
  authenticate,
  managerAccess,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { rows: categories } = await pool.query<{
        id: string; name: string; description: string | null;
        sort_order: number; is_active: boolean;
        visibility_level: string; invoice_display_mode: string;
        invoice_alias: string | null;
      }>(
        `SELECT mc.id, mc.name, mc.description, mc.sort_order, mc.is_active,
                mc.visibility_level, mc.invoice_display_mode, mc.invoice_alias
         FROM menu_categories mc
         ORDER BY mc.sort_order, mc.name`
      );

      const { rows: items } = await pool.query<{
        id: string; category_id: string; product_id: string | null;
        name: string; description: string | null;
        unit_price: string; is_available: boolean; is_deleted: boolean;
        sort_order: number;
      }>(
        `SELECT mi.id, mi.category_id, mi.product_id, mi.name, mi.description,
                mi.unit_price, mi.is_available, mi.is_deleted, mi.sort_order
         FROM menu_items mi
         ORDER BY mi.sort_order, mi.name`
      );

      const itemsByCategory: Record<string, typeof items> = {};
      for (const item of items) {
        if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = [];
        itemsByCategory[item.category_id].push(item);
      }

      const result = categories.map(cat => ({
        ...cat,
        items: (itemsByCategory[cat.id] ?? []).map(i => ({
          ...i,
          unit_price: parseFloat(i.unit_price),
        })),
      }));

      res.json({ menuType: "FULL", categories: result });
    } catch (err) {
      console.error("[Menu] /menu/manager error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
);

export default router;
