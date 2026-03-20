import { Request, Response, NextFunction } from "express";
import { ROLES } from "../config/constants";

// Fields always removed (security — never returned to any client)
const ALWAYS_REMOVE = [
  "password_hash",
  "two_fa_secret",
  "cvv",
] as const;

// Fields masked (shown as "***") for non-admin roles
const MASK_FOR_NON_ADMIN = [
  "card_token",
  "payment_token",
] as const;

// Fields removed entirely for non-admin roles
const REMOVE_FOR_NON_ADMIN = [
  "net_revenue",
  "cost_price",
  "ota_commission",
  "agent_fee_rate",
  "blacklist_reason",
  "internal_notes",
  "vip_tier_internal",
  "commission_trigger",
] as const;

const ADMIN_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

function maskObject(obj: Record<string, unknown>, userRole: string): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

  const isAdmin = ADMIN_ROLES.includes(userRole);
  const result  = { ...obj };

  // Always strip sensitive fields
  for (const field of ALWAYS_REMOVE) {
    delete result[field];
  }

  if (!isAdmin) {
    // Mask payment tokens
    for (const field of MASK_FOR_NON_ADMIN) {
      if (result[field] !== undefined) result[field] = "***";
    }
    // Remove operational/financial fields
    for (const field of REMOVE_FOR_NON_ADMIN) {
      delete result[field];
    }
  }

  return result;
}

/**
 * applyFieldMask
 * Wraps res.json to strip/mask sensitive fields before sending.
 * Apply to specific routes — not globally.
 * USAGE: router.get("/path", auth, applyFieldMask, handler)
 */
export function applyFieldMask(req: Request, res: Response, next: NextFunction): void {
  const userRole = req.user?.role ?? "";
  const originalJson = res.json.bind(res) as (body: unknown) => Response;

  (res as Response & { json: (body: unknown) => Response }).json = (data: unknown) => {
    try {
      if (Array.isArray(data)) {
        data = data.map((item: unknown) =>
          item && typeof item === "object"
            ? maskObject(item as Record<string, unknown>, userRole)
            : item,
        );
      } else if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        if (Array.isArray(d["data"])) {
          d["data"] = (d["data"] as unknown[]).map((item: unknown) =>
            item && typeof item === "object"
              ? maskObject(item as Record<string, unknown>, userRole)
              : item,
          );
        } else {
          data = maskObject(d, userRole);
        }
      }
    } catch (err) {
      console.error("[FieldMask] Masking error:", (err as Error).message);
      // Never block response on masking failure
    }
    return originalJson(data);
  };

  next();
}

export { maskObject };
