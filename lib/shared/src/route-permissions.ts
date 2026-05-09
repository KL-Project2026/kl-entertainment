// Single source of truth for route-level RBAC.
// Spec: docs/OPERATIONS_WORKFLOW.md §15.
//
// Both backend (Express middleware) and frontend (sidebar / route guards)
// MUST consume this map to keep RBAC checks in sync. Adding a new route?
// Add it here first, then wire the consumers.
//
// MIGRATION: .NET — convert to [Authorize(Policy="...")] attributes by
// generating policy registration from this same source via build script.

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "MANAGER"
  | "INVESTOR"
  | "HOSTESS"
  | "DRIVER"
  | "KITCHEN"
  | "HALL"
  | "GENERAL";

export const ALL_ROLES: readonly Role[] = [
  "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "INVESTOR",
  "HOSTESS", "DRIVER", "KITCHEN", "HALL", "GENERAL",
] as const;

export const STAFF_ROLES: readonly Role[] = [
  "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER",
  "HOSTESS", "DRIVER", "KITCHEN", "HALL", "GENERAL",
] as const;

const MANAGER_UP: readonly Role[] = ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"] as const;

export const ROUTE_PERMISSIONS: Readonly<Record<string, readonly Role[]>> = {
  "/dashboard":              MANAGER_UP,
  "/room-board":             MANAGER_UP,
  "/reservations":           MANAGER_UP,
  "/pos":                    MANAGER_UP,
  "/products":               MANAGER_UP,
  "/staff":                  MANAGER_UP,
  "/hostess":                MANAGER_UP,
  "/agencies":               MANAGER_UP,
  "/schedule-builder":       MANAGER_UP,
  "/attendance":             MANAGER_UP,
  "/invoices":               MANAGER_UP,
  "/table-classes":          MANAGER_UP,
  "/daily-report":           MANAGER_UP,
  "/reports":                MANAGER_UP,
  "/shareholders":           ["SUPER_ADMIN", "ADMIN"],
  "/investor-dashboard":     ["SUPER_ADMIN", "ADMIN", "INVESTOR"],
  "/investor-reports":       ["SUPER_ADMIN", "ADMIN", "INVESTOR"],
  "/settings/branches":      ["SUPER_ADMIN", "ADMIN"],
  "/settings/menu":          ["SUPER_ADMIN", "ADMIN"],
  "/settings/users":         ["SUPER_ADMIN"],
  "/dashboards/branch-manager": ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
  "/dashboards/manager":        ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER"],
  "/dashboards/hostess":        ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "HOSTESS"],
  "/dashboards/driver":         ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "DRIVER"],
  "/dashboards/kitchen":        ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "KITCHEN"],
  "/dashboards/hall":           ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "HALL"],
  "/dashboards/general":        ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "MANAGER", "GENERAL"],
  "/my-profile":                ALL_ROLES,
  "/my-ledger":                 STAFF_ROLES,
} as const;

// Routes that the INVESTOR role MUST NOT access. Backend Express middleware
// uses these as URL prefixes; .NET will convert to a "DenyInvestor" policy.
export const INVESTOR_BLOCKED_ROUTES: readonly string[] = Object.entries(ROUTE_PERMISSIONS)
  .filter(([, roles]) => !roles.includes("INVESTOR"))
  .map(([path]) => path);

export function canAccessRoute(role: Role, path: string): boolean {
  // Exact match first, then longest-prefix match (covers /reservations/:id etc.).
  const exact = ROUTE_PERMISSIONS[path];
  if (exact) return exact.includes(role);
  const prefixed = Object.entries(ROUTE_PERMISSIONS)
    .filter(([p]) => path.startsWith(p + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return prefixed ? prefixed[1].includes(role) : false;
}

export function rolesForRoute(path: string): readonly Role[] {
  return ROUTE_PERMISSIONS[path] ?? [];
}
