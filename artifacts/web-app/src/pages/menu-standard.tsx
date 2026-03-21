import { useState, useEffect, useCallback } from "react";
import { BookOpen, RefreshCw, ChevronDown, ChevronRight, Search, X, Package } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  category_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  is_available: boolean;
  sort_order: number;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  visibility_level: string;
  invoice_display_mode: string;
  invoice_alias: string | null;
  items: MenuItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMYR(amount: number) {
  return `MYR ${amount.toFixed(2)}`;
}

const VISIBILITY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  ALL:           { label: "All Staff",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  MANAGER_ONLY:  { label: "Manager+",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  ADMIN_ONLY:    { label: "Admin Only",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: "rgba(255,255,255,0.07)",
      animation: "pulse 1.8s ease-in-out infinite",
    }} />
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({ item }: { item: MenuItem }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      opacity: item.is_available ? 1 : 0.45,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, color: item.is_available ? "#e5e7eb" : "#6b7280", fontWeight: 500 }}>
          {item.name}
        </span>
        {item.description && (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2, marginBottom: 0 }}>
            {item.description}
          </p>
        )}
        {!item.is_available && (
          <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, letterSpacing: "0.05em" }}>
            UNAVAILABLE
          </span>
        )}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#D1AE38", minWidth: 90, textAlign: "right" }}>
        {formatMYR(item.unit_price)}
      </span>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ category, showVisibility, defaultOpen }: {
  category: MenuCategory;
  showVisibility: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const badge = VISIBILITY_BADGES[category.visibility_level];

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      overflow: "hidden",
      background: "rgba(255,255,255,0.02)",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          background: "none", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {open ? <ChevronDown size={15} color="#6b7280" /> : <ChevronRight size={15} color="#6b7280" />}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f3f4f6" }}>{category.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 5,
            background: "rgba(255,255,255,0.06)", color: "#9ca3af",
          }}>
            {category.items.length} item{category.items.length !== 1 ? "s" : ""}
          </span>
          {showVisibility && badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              padding: "2px 7px", borderRadius: 9,
              background: badge.bg, color: badge.color,
              border: `1px solid ${badge.color}33`,
            }}>
              {badge.label}
            </span>
          )}
        </div>
      </button>

      {/* Items */}
      {open && (
        category.items.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center", color: "#4b5563", fontSize: 13 }}>
            No items in this category
          </div>
        ) : (
          <div>
            {category.items.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        )
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MenuStandard() {
  const { user } = useAuthStore();

  const isManager = ["super_admin", "admin", "branch_manager", "manager"].includes(user?.role ?? "");

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuType, setMenuType]     = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");

  const fetchMenu = useCallback(async () => {
    try {
      const r = await fetch("/api/menu/standard");
      if (!r.ok) return;
      const j = await r.json();
      setCategories(j.categories ?? []);
      setMenuType(j.menuType ?? "STANDARD");
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Client-side search — filter categories whose name or any item name matches
  const filtered = search
    ? categories
        .map(cat => ({
          ...cat,
          items: cat.items.filter(i =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            (i.description ?? "").toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(cat =>
          cat.name.toLowerCase().includes(search.toLowerCase()) || cat.items.length > 0
        )
    : categories;

  const totalItems = filtered.reduce((s, c) => s + c.items.length, 0);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(209,174,56,0.12)", border: "1px solid rgba(209,174,56,0.25)",
          }}>
            <BookOpen size={18} color="#D1AE38" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f3f4f6", margin: 0 }}>
              Menu Order
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              {menuType === "FULL" ? "Full menu — all categories visible" : "Standard menu"}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchMenu(); }}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#9ca3af", cursor: "pointer", padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, minHeight: 44,
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search menu items or categories…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "11px 36px 11px 36px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, fontSize: 13, color: "#e5e7eb", outline: "none",
            minHeight: 44,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(209,174,56,0.4)"; }}
          onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton w="40%" h={16} />
              <Skeleton w="70%" h={12} />
              <Skeleton w="55%" h={12} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <Package size={36} color="#374151" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
            {search ? "No items match your search" : "No menu categories available"}
          </p>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            {search ? "Try a different search term." : "Menu categories will appear here once added by an admin."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((cat, i) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              showVisibility={isManager}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div style={{
          fontSize: 12, color: "#4b5563", paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          {filtered.length} categor{filtered.length !== 1 ? "ies" : "y"} · {totalItems} item{totalItems !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>
      )}
    </div>
  );
}
