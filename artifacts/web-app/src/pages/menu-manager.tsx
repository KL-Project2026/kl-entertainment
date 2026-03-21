import { useState, useEffect, useCallback } from "react";
import { Lock, RefreshCw, ChevronDown, ChevronRight, Search, X, Eye, EyeOff, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  category_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  is_available: boolean;
  is_deleted: boolean;
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

const VISIBILITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ALL:          { label: "All Staff",   color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)" },
  MANAGER_ONLY: { label: "Manager+",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  ADMIN_ONLY:   { label: "Admin Only",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" },
};

const DISPLAY_MODE_LABELS: Record<string, string> = {
  REAL_NAME:    "Real Name",
  MASKED_CODE:  "SVC-XXX Code",
  MASKED_SYMBOL:"XXXX Symbol",
  CUSTOM_ALIAS: "Custom Alias",
};

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
function ItemRow({ item, maskMode, alias }: { item: MenuItem; maskMode: string; alias: string | null }) {
  const masked =
    maskMode === "MASKED_CODE"   ? `SVC-${item.id.slice(0, 3).toUpperCase()}` :
    maskMode === "MASKED_SYMBOL" ? "XXXX" :
    maskMode === "CUSTOM_ALIAS"  ? (alias || "■■■■") :
    null;

  const faded = item.is_deleted || !item.is_available;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      opacity: faded ? 0.4 : 1,
      gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500 }}>{item.name}</span>
          {item.is_deleted && (
            <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, letterSpacing: "0.05em" }}>DELETED</span>
          )}
          {!item.is_available && !item.is_deleted && (
            <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.05em" }}>UNAVAILABLE</span>
          )}
        </div>
        {item.description && (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2, marginBottom: 0 }}>{item.description}</p>
        )}
        {masked && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            <EyeOff size={10} color="#6b7280" />
            <span style={{ fontSize: 10, color: "#6b7280" }}>Invoice displays as: </span>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#f59e0b", fontWeight: 700 }}>
              {masked}
            </span>
          </div>
        )}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#D1AE38", minWidth: 90, textAlign: "right", flexShrink: 0 }}>
        {formatMYR(item.unit_price)}
      </span>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ category }: { category: MenuCategory }) {
  const [open, setOpen] = useState(false);
  const vis    = VISIBILITY_CONFIG[category.visibility_level] ?? VISIBILITY_CONFIG.ALL;
  const isSpecial = category.visibility_level !== "ALL";

  const activeItems  = category.items.filter(i => !i.is_deleted);
  const deletedItems = category.items.filter(i => i.is_deleted);

  return (
    <div style={{
      border: `1px solid ${isSpecial ? vis.border : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12,
      overflow: "hidden",
      background: isSpecial ? vis.bg : "rgba(255,255,255,0.02)",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          background: "none", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {open ? <ChevronDown size={15} color="#6b7280" /> : <ChevronRight size={15} color="#6b7280" />}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f3f4f6" }}>{category.name}</span>

          {/* Visibility badge */}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            padding: "2px 7px", borderRadius: 9,
            background: vis.bg, color: vis.color,
            border: `1px solid ${vis.border}`,
          }}>
            {vis.label}
          </span>

          {/* Invoice display mode badge */}
          {isSpecial && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 5,
              background: "rgba(255,255,255,0.06)", color: "#9ca3af",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <EyeOff size={9} />
              {DISPLAY_MODE_LABELS[category.invoice_display_mode] ?? category.invoice_display_mode}
              {category.invoice_display_mode === "CUSTOM_ALIAS" && category.invoice_alias && (
                <span style={{ color: "#f59e0b" }}>"{category.invoice_alias}"</span>
              )}
            </span>
          )}

          {!category.is_active && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em" }}>
              INACTIVE
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>
          {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
          {deletedItems.length > 0 && ` · ${deletedItems.length} deleted`}
        </span>
      </button>

      {/* Items */}
      {open && (
        category.items.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center", color: "#4b5563", fontSize: 13 }}>
            No items in this category
          </div>
        ) : (
          <div>
            {category.items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                maskMode={category.invoice_display_mode}
                alias={category.invoice_alias}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Manager Access Guard ──────────────────────────────────────────────────────
const MANAGER_ROLES = new Set(["super_admin", "admin", "branch_manager", "manager"]);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const { user } = useAuthStore();
  const [, navigate] = useLocation();

  // Redirect non-managers
  if (user && !MANAGER_ROLES.has(user.role)) {
    navigate("/");
    return null;
  }

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");

  const fetchMenu = useCallback(async () => {
    try {
      const r = await fetch("/api/menu/manager");
      if (!r.ok) return;
      const j = await r.json();
      setCategories(j.categories ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const filtered = search
    ? categories.filter(cat =>
        cat.name.toLowerCase().includes(search.toLowerCase()) ||
        cat.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
      )
    : categories;

  const specialCount = filtered.filter(c => c.visibility_level !== "ALL").length;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
          }}>
            <Lock size={18} color="#f59e0b" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f3f4f6", margin: 0 }}>
              Full Menu
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                padding: "2px 8px", borderRadius: 8,
                background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.3)",
                marginLeft: 10, verticalAlign: "middle",
              }}>
                MANAGER
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              All categories including restricted — invoice masking applied on receipts
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

      {/* Legend */}
      {!loading && categories.length > 0 && (
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap",
          padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#6b7280" }}>
            <Shield size={12} color="#6b7280" /> Category visibility:
          </div>
          {Object.entries(VISIBILITY_CONFIG).map(([key, cfg]) => (
            <span key={key} style={{
              fontSize: 11, fontWeight: 600,
              padding: "2px 8px", borderRadius: 8,
              background: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.border}`,
            }}>
              {cfg.label}
            </span>
          ))}
          <span style={{ color: "#4b5563" }}>·</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#6b7280" }}>
            <Eye size={12} color="#6b7280" />
            Invoice masking applied for highlighted categories
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search categories or items…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "11px 36px 11px 36px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, fontSize: 13, color: "#e5e7eb", outline: "none",
            minHeight: 44,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; }}
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
              <Skeleton w="35%" h={16} />
              <Skeleton w="60%" h={12} />
              <Skeleton w="50%" h={12} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <Lock size={36} color="#374151" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
            {search ? "No categories match your search" : "No menu categories yet"}
          </p>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            {search ? "Try a different search term." : "Add categories via the admin panel to get started."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(cat => <CategoryCard key={cat.id} category={cat} />)}
        </div>
      )}

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 12, color: "#4b5563", paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: 8,
        }}>
          <span>
            {filtered.length} categor{filtered.length !== 1 ? "ies" : "y"}
            {search && ` matching "${search}"`}
          </span>
          {specialCount > 0 && (
            <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: 4 }}>
              <EyeOff size={11} /> {specialCount} restricted categor{specialCount !== 1 ? "ies" : "y"} — invoice masking active
            </span>
          )}
        </div>
      )}
    </div>
  );
}
