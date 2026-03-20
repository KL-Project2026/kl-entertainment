import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { motion } from "framer-motion";
import { LayoutDashboard, Grid, Building2, Package, LogOut, CalendarDays, ShoppingCart, Users, CalendarCheck, Clock, Handshake, PieChart, LineChart, BarChart2, Globe, Receipt, Table2, FileBarChart } from "lucide-react";
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

// All role values used in the nav guard
type NavRole =
  | "super_admin" | "admin" | "investor"
  | "branch_manager" | "manager"
  | "hostess" | "driver" | "kitchen" | "hall" | "general";

// Shorthand sets for readability
const ADMIN_UP:   NavRole[] = ["super_admin", "admin"];
const MANAGER_UP: NavRole[] = ["super_admin", "admin", "branch_manager", "manager"];
const OPS_UP:     NavRole[] = ["super_admin", "admin", "branch_manager", "manager", "kitchen", "hall", "general"];

const NAV_ITEMS: { path: string; key: string; icon: React.ComponentType<{ className?: string }>; roles: NavRole[] }[] = [
  // Dashboard — all operational roles
  { path: "/",                   key: "nav.dashboard",        icon: LayoutDashboard, roles: OPS_UP },
  // Room board — operational staff
  { path: "/room-board",         key: "nav.room_board",       icon: Grid,            roles: OPS_UP },
  // Reservations — managers+
  { path: "/reservations",       key: "nav.reservations",     icon: CalendarDays,    roles: MANAGER_UP },
  // POS — all operational
  { path: "/pos",                key: "nav.pos",              icon: ShoppingCart,    roles: OPS_UP },
  // Staff management — managers+
  { path: "/staff",              key: "nav.staff",            icon: Users,           roles: MANAGER_UP },
  // Schedule — managers+
  { path: "/schedule-builder",   key: "nav.schedules",        icon: CalendarCheck,   roles: MANAGER_UP },
  // Attendance — managers+
  { path: "/attendance",         key: "nav.attendance",       icon: Clock,           roles: MANAGER_UP },
  // Agents — admin+
  { path: "/agents",             key: "nav.agents",           icon: Handshake,       roles: ADMIN_UP },
  // Shareholders — admin+
  { path: "/shareholders",       key: "nav.shareholders",     icon: PieChart,        roles: ADMIN_UP },
  // Investor views — investor + admin+
  { path: "/investor-dashboard", key: "nav.investor",         icon: LineChart,       roles: ["super_admin", "admin", "investor"] },
  { path: "/investor-reports",   key: "nav.investor_reports", icon: PieChart,        roles: ["super_admin", "admin", "investor"] },
  // Hostess dashboard — visible to managers + hostess themselves
  { path: "/hostess-dashboard",  key: "nav.hostess_dashboard",icon: Users,           roles: ["super_admin", "admin", "branch_manager", "manager", "hostess"] },
  // Invoices — managers+
  { path: "/invoices",           key: "nav.invoices",         icon: Receipt,         roles: MANAGER_UP },
  // Tables — managers+
  { path: "/tables",             key: "nav.tables",           icon: Table2,          roles: MANAGER_UP },
  // Reports — managers+
  { path: "/reports/daily",      key: "nav.daily_report",     icon: FileBarChart,    roles: MANAGER_UP },
  { path: "/reports",            key: "nav.reports",          icon: BarChart2,       roles: MANAGER_UP },
  // Branches + Products — admin+
  { path: "/branches",           key: "nav.branches",         icon: Building2,       roles: ADMIN_UP },
  { path: "/products",           key: "nav.products",         icon: Package,         roles: MANAGER_UP },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();

  const activeItem = NAV_ITEMS.find((i) => {
    if (i.path === "/") return location === "/";
    return location === i.path || location.startsWith(i.path + "/");
  });

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("kl_lang", code);
  };

  return (
    <div className="min-h-screen bg-[#07070A] flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-card/30 backdrop-blur-2xl flex flex-col relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-[#AA8A2E] flex items-center justify-center text-primary-foreground font-display font-bold text-xl shadow-lg shadow-primary/20">
              KL
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight text-glow">KL Group</h1>
              <p className="text-xs text-primary/70 tracking-widest uppercase">Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) =>
            !user?.role || item.roles.includes(user.role as NavRole)
          ).map((item) => {
            const isActive = activeItem?.path === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className="block">
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="font-medium relative z-10 text-sm">{t(item.key)}</span>
                  {!isActive && (
                    <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-black/40 rounded-xl p-4 border border-white/5">
            <p className="font-medium text-sm text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{user?.role.replace("_", " ")}</p>

            <div className="mt-3 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-primary/60" />
              <select
                value={i18n.language}
                onChange={(e) => handleLang(e.target.value)}
                className="bg-transparent text-xs text-muted-foreground focus:outline-none cursor-pointer flex-1"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#07070A] text-white">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={logout}
              className="mt-3 flex items-center gap-2 text-sm text-destructive/80 hover:text-destructive transition-colors w-full p-2 hover:bg-destructive/10 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>{t("auth.sign_out")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />

        <header className="h-20 border-b border-white/5 bg-card/20 backdrop-blur-md flex items-center px-8 justify-between z-10">
          <h2 className="font-display text-2xl font-semibold text-foreground/90">
            {activeItem ? t(activeItem.key) : t("nav.dashboard")}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground text-glow">
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
