import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { motion } from "framer-motion";
import { LayoutDashboard, Grid, Building2, Package, LogOut, CalendarDays, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/room-board", label: "Room Board", icon: Grid },
  { path: "/reservations", label: "Reservations", icon: CalendarDays },
  { path: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { path: "/branches", label: "Branches", icon: Building2 },
  { path: "/products", label: "Product Catalog", icon: Package },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  // Match active item — support sub-paths like /reservations/new
  const activeItem = NAV_ITEMS.find(i => {
    if (i.path === "/") return location === "/";
    return location === i.path || location.startsWith(i.path + "/");
  });

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

        <nav className="flex-1 px-4 py-8 space-y-1">
          {NAV_ITEMS.map((item) => {
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
                  <span className="font-medium relative z-10 text-sm">{item.label}</span>
                  
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
            <p className="text-xs text-muted-foreground capitalize mt-1">{user?.role.replace('_', ' ')}</p>
            
            <button 
              onClick={logout}
              className="mt-4 flex items-center gap-2 text-sm text-destructive/80 hover:text-destructive transition-colors w-full p-2 hover:bg-destructive/10 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
        
        <header className="h-20 border-b border-white/5 bg-card/20 backdrop-blur-md flex items-center px-8 justify-between z-10">
          <h2 className="font-display text-2xl font-semibold text-foreground/90">
            {activeItem?.label || "Dashboard"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <p className="text-xs text-muted-foreground text-glow">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
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
