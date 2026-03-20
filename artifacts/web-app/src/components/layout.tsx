import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Grid, Building2, Package, LogOut, CalendarDays,
  ShoppingCart, Users, CalendarCheck, Clock, Handshake, PieChart,
  LineChart, BarChart2, Globe, Receipt, Table2, FileBarChart, Menu, X,
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

const NAV_ITEMS: { path: string; key: string; icon: React.ComponentType<{ className?: string }>; roles: NavRole[] }[] = [
  { path: "/",                   key: "nav.dashboard",         icon: LayoutDashboard, roles: OPS_UP },
  { path: "/room-board",         key: "nav.room_board",        icon: Grid,            roles: OPS_UP },
  { path: "/reservations",       key: "nav.reservations",      icon: CalendarDays,    roles: MANAGER_UP },
  { path: "/pos",                key: "nav.pos",               icon: ShoppingCart,    roles: OPS_UP },
  { path: "/staff",              key: "nav.staff",             icon: Users,           roles: MANAGER_UP },
  { path: "/schedule-builder",   key: "nav.schedules",         icon: CalendarCheck,   roles: MANAGER_UP },
  { path: "/attendance",         key: "nav.attendance",        icon: Clock,           roles: MANAGER_UP },
  { path: "/agents",             key: "nav.agents",            icon: Handshake,       roles: ADMIN_UP },
  { path: "/shareholders",       key: "nav.shareholders",      icon: PieChart,        roles: ADMIN_UP },
  { path: "/investor-dashboard", key: "nav.investor",          icon: LineChart,       roles: ["super_admin", "admin", "investor"] },
  { path: "/investor-reports",   key: "nav.investor_reports",  icon: PieChart,        roles: ["super_admin", "admin", "investor"] },
  { path: "/hostess-dashboard",  key: "nav.hostess_dashboard", icon: Users,           roles: ["super_admin", "admin", "branch_manager", "manager", "hostess"] },
  { path: "/invoices",           key: "nav.invoices",          icon: Receipt,         roles: MANAGER_UP },
  { path: "/tables",             key: "nav.tables",            icon: Table2,          roles: MANAGER_UP },
  { path: "/reports/daily",      key: "nav.daily_report",      icon: FileBarChart,    roles: MANAGER_UP },
  { path: "/reports",            key: "nav.reports",           icon: BarChart2,       roles: MANAGER_UP },
  { path: "/branches",           key: "nav.branches",          icon: Building2,       roles: ADMIN_UP },
  { path: "/products",           key: "nav.products",          icon: Package,         roles: MANAGER_UP },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar automatically on route change (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const activeItem = NAV_ITEMS.find((i) => {
    if (i.path === "/") return location === "/";
    return location === i.path || location.startsWith(i.path + "/");
  });

  const visibleNav = NAV_ITEMS.filter(
    (item) => !user?.role || item.roles.includes(user.role as NavRole),
  );

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("kl_lang", code);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 md:h-20 flex items-center px-5 md:px-6 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-primary to-[#AA8A2E] flex items-center justify-center text-primary-foreground font-display font-bold text-lg md:text-xl shadow-lg shadow-primary/20 flex-shrink-0">
            KL
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-base md:text-lg leading-tight text-glow truncate">KL Group</h1>
            <p className="text-xs text-primary/70 tracking-widest uppercase">Management</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden ml-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors flex-shrink-0"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 md:px-4 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = activeItem?.path === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} className="block">
              <div className={cn(
                "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 relative group cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 relative z-10 flex-shrink-0" />
                <span className="font-medium relative z-10 text-sm truncate">{t(item.key)}</span>
                {!isActive && (
                  <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 md:p-4 border-t border-white/5 flex-shrink-0">
        <div className="bg-black/40 rounded-xl p-3 md:p-4 border border-white/5">
          <p className="font-medium text-sm text-foreground truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {user?.role.replace(/_/g, " ")}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <select
              value={i18n.language}
              onChange={(e) => handleLang(e.target.value)}
              className="bg-transparent text-xs text-muted-foreground focus:outline-none cursor-pointer flex-1 min-w-0"
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
    </>
  );

  return (
    <div className="min-h-screen bg-[#07070A] flex overflow-hidden">

      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-card/30 backdrop-blur-2xl flex-col relative z-20 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar drawer + backdrop ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop — full screen, tap right side to close */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden touch-none"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer — sits above backdrop */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] border-r border-white/5 bg-[#0c0c10] flex flex-col z-50 md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />

        {/* Header */}
        <header className="h-14 md:h-20 border-b border-white/5 bg-card/20 backdrop-blur-md flex items-center px-4 md:px-8 gap-3 justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="font-display text-lg md:text-2xl font-semibold text-foreground/90 truncate">
              {activeItem ? t(activeItem.key) : t("nav.dashboard")}
            </h2>
          </div>

          {/* Date/time — hidden on very small screens */}
          <div className="hidden sm:block text-right flex-shrink-0">
            <p className="text-sm font-medium text-foreground">
              {new Date().toLocaleDateString("en-MY", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 z-10">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
