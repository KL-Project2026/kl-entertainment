import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Grid, Building2, Package, LogOut, CalendarDays,
  ShoppingCart, Users, CalendarCheck, Clock, Handshake, PieChart,
  LineChart, BarChart2, Globe, Receipt, Table2, FileBarChart, Menu, X,
  UserCheck, Briefcase, Settings, LayoutList, Users2, ClipboardList,
  Car, ChefHat, UserCircle, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
  { code: "ms", label: "BM" },
  { code: "ja", label: "JP" },
  { code: "ko", label: "KR" },
  { code: "th", label: "TH" },
];

type NavRole =
  | "super_admin" | "admin" | "investor"
  | "branch_manager" | "manager"
  | "hostess" | "driver" | "kitchen" | "hall" | "general";

const ADMIN_UP:   NavRole[] = ["super_admin", "admin"];
const MANAGER_UP: NavRole[] = ["super_admin", "admin", "branch_manager", "manager"];
const OPS_UP:     NavRole[] = ["super_admin", "admin", "branch_manager", "manager", "kitchen", "hall", "general"];
const ALL_ROLES:       NavRole[] = ["super_admin","admin","investor","branch_manager","manager","hostess","driver","kitchen","hall","general"];
const STAFF_ROLES:     NavRole[] = ["super_admin","admin","branch_manager","manager","hostess","driver","kitchen","hall","general"];

type NavItem = { path: string; key: string; icon: React.ComponentType<{ className?: string }>; roles: NavRole[] };

// ── RBAC SOURCE OF TRUTH ─────────────────────────────────────────────────────
// Canonical role-to-path mapping lives in `@workspace/shared/route-permissions`.

const NAV_ITEMS: NavItem[] = [
  { path: "/",                   key: "nav.dashboard",         icon: LayoutDashboard, roles: OPS_UP },
  { path: "/room-board",         key: "nav.room_board",        icon: Grid,            roles: OPS_UP },
  { path: "/reservations",       key: "nav.reservations",      icon: CalendarDays,    roles: MANAGER_UP },
  { path: "/pos",                key: "nav.pos",               icon: ShoppingCart,    roles: OPS_UP },
  { path: "/staff",              key: "nav.staff",             icon: Users,           roles: MANAGER_UP },
  { path: "/staff/hostesses",    key: "nav.hostess_profiles",  icon: UserCheck,       roles: MANAGER_UP },
  { path: "/agencies",           key: "nav.agencies",          icon: Briefcase,       roles: MANAGER_UP },
  { path: "/schedule-builder",   key: "nav.schedules",         icon: CalendarCheck,   roles: MANAGER_UP },
  { path: "/attendance",         key: "nav.attendance",        icon: Clock,           roles: MANAGER_UP },
  { path: "/agents",             key: "nav.agents",            icon: Handshake,       roles: ADMIN_UP },
  { path: "/shareholders",       key: "nav.shareholders",      icon: PieChart,        roles: ADMIN_UP },
  { path: "/investor-dashboard", key: "nav.investor",          icon: LineChart,       roles: ["super_admin", "admin", "investor"] },
  { path: "/investor-reports",   key: "nav.investor_reports",  icon: PieChart,        roles: ["super_admin", "admin", "investor"] },
  { path: "/hostess-dashboard",          key: "nav.hostess_dashboard",         icon: ClipboardList,   roles: ["super_admin", "admin", "branch_manager", "manager", "hostess"] },
  { path: "/branch-manager-dashboard",  key: "nav.bm_dashboard",              icon: LayoutDashboard, roles: ["super_admin", "admin", "branch_manager"] },
  { path: "/manager-dashboard",         key: "nav.manager_dashboard",         icon: LayoutDashboard, roles: ["super_admin", "admin", "branch_manager", "manager"] },
  { path: "/driver-dashboard",          key: "nav.driver_dashboard",          icon: Car,             roles: ["super_admin", "admin", "branch_manager", "manager", "driver"] },
  { path: "/kitchen-dashboard",         key: "nav.kitchen_dashboard",         icon: ChefHat,         roles: ["super_admin", "admin", "branch_manager", "manager", "kitchen"] },
  { path: "/hall-dashboard",            key: "nav.hall_dashboard",            icon: LayoutList,      roles: ["super_admin", "admin", "branch_manager", "manager", "hall"] },
  { path: "/general-dashboard",         key: "nav.general_dashboard",         icon: Clock,           roles: ["super_admin", "admin", "branch_manager", "manager", "general"] },
  { path: "/invoices",           key: "nav.invoices",          icon: Receipt,         roles: MANAGER_UP },
  { path: "/tables",             key: "nav.tables",            icon: Table2,          roles: MANAGER_UP },
  { path: "/reports/daily",      key: "nav.daily_report",      icon: FileBarChart,    roles: MANAGER_UP },
  { path: "/reports",            key: "nav.reports",           icon: BarChart2,       roles: MANAGER_UP },
  { path: "/branches",           key: "nav.branches",          icon: Building2,       roles: ADMIN_UP },
  { path: "/products",           key: "nav.products",          icon: Package,         roles: MANAGER_UP },
  { path: "/settings/users",     key: "nav.user_management",   icon: Users2,          roles: ["super_admin"] },
  { path: "/my-profile",         key: "nav.my_profile",         icon: UserCircle,      roles: ALL_ROLES   },
  { path: "/my-ledger",          key: "nav.my_ledger",          icon: BookOpen,        roles: STAFF_ROLES },
];

// §10.2 — Categories grouped by spacing + label only.
// Per-category accent colors are removed in v3.
type CategoryKey = "personal" | "dashboards" | "operations" | "staff" | "finance" | "investors" | "settings";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  items: NavItem[];
}

const DASH_ROLES: NavRole[] = ["super_admin", "admin", "branch_manager", "manager"];

const CATEGORIES: CategoryDef[] = [
  {
    key: "personal",
    label: "Personal",
    items: [
      { path: "/my-profile",     key: "nav.my_profile",    icon: UserCircle, roles: ALL_ROLES   },
      { path: "/my-ledger",      key: "nav.my_ledger",     icon: BookOpen,   roles: STAFF_ROLES },
    ],
  },
  {
    key: "dashboards",
    label: "Dashboards",
    items: [
      { path: "/branch-manager-dashboard", key: "nav.bm_dashboard",        icon: LayoutDashboard, roles: ["super_admin", "admin", "branch_manager"] },
      { path: "/manager-dashboard",        key: "nav.manager_dashboard",   icon: LayoutDashboard, roles: DASH_ROLES },
      { path: "/hostess-dashboard",        key: "nav.hostess_dashboard",   icon: ClipboardList,   roles: DASH_ROLES },
      { path: "/driver-dashboard",         key: "nav.driver_dashboard",    icon: Car,             roles: DASH_ROLES },
      { path: "/kitchen-dashboard",        key: "nav.kitchen_dashboard",   icon: ChefHat,         roles: DASH_ROLES },
      { path: "/hall-dashboard",           key: "nav.hall_dashboard",      icon: LayoutList,      roles: DASH_ROLES },
      { path: "/general-dashboard",        key: "nav.general_dashboard",   icon: Clock,           roles: DASH_ROLES },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { path: "/",                    key: "nav.dashboard",        icon: LayoutDashboard, roles: OPS_UP },
      { path: "/room-board",          key: "nav.room_board",       icon: Grid,            roles: OPS_UP },
      { path: "/reservations",        key: "nav.reservations",     icon: CalendarDays,    roles: MANAGER_UP },
      { path: "/pos",                 key: "nav.pos",              icon: ShoppingCart,    roles: OPS_UP },
      { path: "/products",            key: "nav.products",         icon: Package,         roles: MANAGER_UP },
      { path: "/hostess-dashboard",   key: "nav.hostess_dashboard",icon: ClipboardList,   roles: ["hostess"] },
      { path: "/driver-dashboard",    key: "nav.driver_dashboard", icon: Car,             roles: ["driver"] },
      { path: "/kitchen-dashboard",   key: "nav.kitchen_dashboard",icon: ChefHat,         roles: ["kitchen"] },
      { path: "/hall-dashboard",      key: "nav.hall_dashboard",   icon: LayoutList,      roles: ["hall"] },
      { path: "/general-dashboard",   key: "nav.general_dashboard",icon: Clock,           roles: ["general"] },
    ],
  },
  {
    key: "staff",
    label: "Staff & Hostess",
    items: [
      { path: "/staff",            key: "nav.staff",            icon: Users,         roles: MANAGER_UP },
      { path: "/staff/hostesses",  key: "nav.hostess_profiles", icon: UserCheck,     roles: MANAGER_UP },
      { path: "/agencies",         key: "nav.agencies",         icon: Briefcase,     roles: MANAGER_UP },
      { path: "/agents",           key: "nav.agents",           icon: Handshake,     roles: ADMIN_UP },
      { path: "/schedule-builder", key: "nav.schedules",        icon: CalendarCheck, roles: MANAGER_UP },
      { path: "/attendance",       key: "nav.attendance",       icon: Clock,         roles: MANAGER_UP },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { path: "/invoices",      key: "nav.invoices",     icon: Receipt,     roles: MANAGER_UP },
      { path: "/tables",        key: "nav.tables",       icon: Table2,      roles: MANAGER_UP },
      { path: "/reports/daily", key: "nav.daily_report", icon: FileBarChart,roles: MANAGER_UP },
      { path: "/reports",       key: "nav.reports",      icon: BarChart2,   roles: MANAGER_UP },
    ],
  },
  {
    key: "investors",
    label: "Investors",
    items: [
      { path: "/shareholders",       key: "nav.shareholders",     icon: PieChart,  roles: ADMIN_UP },
      { path: "/investor-dashboard", key: "nav.investor",         icon: LineChart, roles: ["super_admin", "admin", "investor"] },
      { path: "/investor-reports",   key: "nav.investor_reports", icon: PieChart,  roles: ["super_admin", "admin", "investor"] },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { path: "/branches",             key: "nav.branches",          icon: Building2,  roles: ADMIN_UP },
      { path: "/settings/menu-config", key: "nav.menu_config",       icon: LayoutList, roles: ADMIN_UP },
      { path: "/settings/users",       key: "nav.user_management",   icon: Users2,     roles: ["super_admin"] },
    ],
  },
];

// ── Main Layout ──────────────────────────────────────────────────────────────
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const activeItem = NAV_ITEMS.find((i) => {
    if (i.path === "/") return location === "/";
    return location === i.path || location.startsWith(i.path + "/");
  });

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("kl_lang", code);
  };

  const isItemActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(path + "/");

  const SidebarContent = () => (
    <>
      {/* §1 — Logo: pure type, no gradient badge, no glow */}
      <div className="h-16 flex items-center px-5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-baseline gap-3 flex-1 min-w-0">
          <span className="font-display text-2xl font-medium tracking-tight text-gold leading-none">
            KL
          </span>
          <span className="h-4 w-px bg-border-default" />
          <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-text-secondary leading-none">
            Entertainment <span className="text-text-tertiary">·</span> Management
          </span>
        </div>
        <button
          className="md:hidden ml-2 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors flex-shrink-0"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* §10 — Nav: category labels + spacing only */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {CATEGORIES.map((cat, idx) => {
          const visibleItems = cat.items.filter(
            item => !user?.role || item.roles.includes(user.role as NavRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={cat.key} className={cn(idx > 0 && "mt-4")}>
              <div className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                {cat.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item.path);
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} href={item.path} className="block">
                      <div
                        className={cn(
                          "relative flex items-center gap-2.5 h-9 px-3 rounded-md",
                          "text-[13px] font-medium transition-colors duration-100",
                          active
                            ? "bg-surface-3 text-text-primary"
                            : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
                        )}
                      >
                        {/* §10.3 — 2px gold left rail on active */}
                        {active && (
                          <span
                            aria-hidden
                            className="absolute -left-1 top-2 bottom-2 w-[2px] rounded-full bg-gold"
                          />
                        )}
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="truncate">{t(item.key)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border-subtle flex-shrink-0">
        <div className="rounded-md bg-surface-3 p-3 border border-border-subtle">
          <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
          <p className="text-[11px] text-text-tertiary uppercase tracking-wide mt-0.5">
            {user?.role.replace(/_/g, " ")}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
            <select
              value={i18n.language}
              onChange={(e) => handleLang(e.target.value)}
              className="bg-transparent text-xs text-text-secondary focus:outline-none cursor-pointer flex-1 min-w-0"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} className="bg-surface-1 text-text-primary">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-sm text-text-secondary hover:text-danger transition-colors w-full px-2 py-1.5 hover:bg-danger/10 rounded-md"
          >
            <LogOut className="w-4 h-4" />
            <span>{t("auth.sign_out")}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface-base flex overflow-hidden">

      {/* Desktop sidebar — §9.2 (240px) */}
      <aside className="hidden md:flex w-60 border-r border-border-subtle bg-surface-1 flex-col relative z-20 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-surface-overlay z-40 md:hidden touch-none"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer animation kept (§11.3 — drawer spring allowed) */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 35, stiffness: 400 }}
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] border-r border-border-subtle bg-surface-1 flex flex-col z-50 md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        {/* §6.1 — radial gradient background removed */}

        {/* Header — solid surface-1, no backdrop blur */}
        <header className="h-14 md:h-16 border-b border-border-subtle bg-surface-1 flex items-center px-4 md:px-8 gap-3 justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* §3 — h2 in Inter, not Playfair */}
            <h2 className="text-base md:text-lg font-semibold text-text-primary truncate">
              {activeItem ? t(activeItem.key) : t("nav.dashboard")}
            </h2>
          </div>

          <div className="hidden sm:block text-right flex-shrink-0">
            <p className="text-sm font-medium text-text-primary font-mono tabular-nums">
              {new Date().toLocaleDateString("en-MY", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <p className="text-xs text-text-tertiary font-mono tabular-nums">
              {new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </header>

        {/* §11.4 — page transition motion removed.
           Page padding kept on the wrapper for back-compat with existing pages
           that don't yet declare their own (§9.1) outer <main>. New pages may
           use `p-0` on root and apply spec padding internally. */}
        <div className="flex-1 overflow-auto z-10 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
