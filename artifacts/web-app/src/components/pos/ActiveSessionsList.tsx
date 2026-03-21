// NEW: POS Active Sessions Entry Point — added 2026-03-21

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { useListBranches } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, X, RefreshCw, Mic } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActiveSession {
  reservationId:     string;
  reservationNo:     string;
  customerName:      string | null;
  customerPhone:     string | null;
  guestCount:        number;
  startTime:         string;
  endTime:           string | null;
  reservationStatus: string;
  roomId:            string;
  roomName:          string;
  roomType:          string;
  roomStatus:        string;
  branchId:          string;
  branchName:        string;
  branchCode:        string;
  folioTotal:        number;
  orderId:           string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatElapsed(startTime: string): string {
  const start = new Date(startTime);
  const now   = new Date();
  const mins  = Math.floor((now.getTime() - start.getTime()) / 60000);
  if (mins < 0) return "Not started";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m elapsed`;
  return `${h}h ${m}m elapsed`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number): string {
  return `MYR ${amount.toFixed(2)}`;
}

const ROOM_STATUS_DOT: Record<string, { color: string; title: string }> = {
  occupied:    { color: "#22c55e", title: "Occupied" },
  available:   { color: "#fbbf24", title: "Available" },
  cleaning:    { color: "#9ca3af", title: "Cleaning" },
  maintenance: { color: "#ef4444", title: "Under Maintenance" },
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  private_room: "Private Room",
  vip_suite:    "VIP Suite",
  karaoke:      "Karaoke",
  standard:     "Standard",
  deluxe:       "Deluxe",
};

const isClickable = (s: ActiveSession) =>
  !["cleaning", "maintenance"].includes(s.roomStatus);

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12,
    }}>
      {[["60%", 14], ["45%", 12], ["80%", 12], ["35%", 16]].map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w as string, background: "rgba(255,255,255,0.07)",
          borderRadius: 6, animation: "pulse 1.8s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session, showBranch, onOpen,
}: { session: ActiveSession; showBranch: boolean; onOpen: () => void }) {
  const dot    = ROOM_STATUS_DOT[session.roomStatus] ?? { color: "#9ca3af", title: session.roomStatus };
  const active = isClickable(session);

  return (
    <div
      onClick={active ? onOpen : undefined}
      title={!active ? dot.title : undefined}
      style={{
        background: active ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${active ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)"}`,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: active ? "pointer" : "not-allowed",
        opacity: active ? 1 : 0.55,
        transition: "border-color 150ms ease, box-shadow 150ms ease",
        display: "flex", flexDirection: "column", gap: 10,
        position: "relative",
      }}
      onMouseEnter={e => {
        if (!active) return;
        const el = e.currentTarget;
        el.style.borderColor = "rgba(209,174,56,0.35)";
        el.style.boxShadow   = "0 0 0 1px rgba(209,174,56,0.2)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(255,255,255,0.09)";
        el.style.boxShadow   = "none";
      }}
    >
      {/* Branch badge (only in all-branches view) */}
      {showBranch && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          padding: "2px 7px", borderRadius: 9,
          background: "rgba(209,174,56,0.12)", color: "#D1AE38",
          border: "1px solid rgba(209,174,56,0.25)",
        }}>
          {session.branchCode || session.branchName}
        </span>
      )}

      {/* Row 1: Status dot + Room + Type */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 9, height: 9, borderRadius: "50%",
          background: dot.color, flexShrink: 0,
          boxShadow: active ? `0 0 6px ${dot.color}88` : "none",
        }} title={dot.title} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f3f4f6" }}>
          {session.roomName}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
          padding: "1px 6px", borderRadius: 5,
          background: "rgba(255,255,255,0.06)", color: "#9ca3af",
        }}>
          {ROOM_TYPE_LABELS[session.roomType] ?? session.roomType.replace("_", " ")}
        </span>
      </div>

      {/* Row 2: Reservation # + guest count */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#D1AE38", letterSpacing: "0.03em" }}>
          {session.reservationNo}
        </span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {session.customerName || "Walk-in"} · {session.guestCount} pax
        </span>
      </div>

      {/* Row 3: Time info */}
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
        <span>Started: {formatTime(session.startTime)}</span>
        <span style={{ color: "#9ca3af" }}>{formatElapsed(session.startTime)}</span>
        {session.endTime && (
          <span>Expected out: {formatTime(session.endTime)}</span>
        )}
      </div>

      {/* Row 4: Running total + Open Bill button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div>
          {session.folioTotal > 0 ? (
            <span style={{ fontSize: 17, fontWeight: 800, color: "#D1AE38" }}>
              {formatCurrency(session.folioTotal)}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "#4b5563" }}>No bill yet</span>
          )}
        </div>
        {active && (
          <button
            onClick={e => { e.stopPropagation(); onOpen(); }}
            style={{
              padding: "8px 16px",
              background: "rgba(209,174,56,0.88)",
              color: "#0a0a0a", border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: 5,
              minHeight: 44, minWidth: 44,
              transition: "background 150ms ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(209,174,56,1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(209,174,56,0.88)"; }}
          >
            <ShoppingCart size={13} /> Open Bill →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActiveSessionsList() {
  const [, navigate]    = useLocation();
  const { user, token } = useAuthStore();

  const isSuperUser = user?.role === "super_admin" || user?.role === "admin";

  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data ?? [];

  const [branchFilter, setBranchFilter] = useState(
    isSuperUser ? "" : (user?.branchId ?? "")
  );
  const [search,    setSearch]    = useState("");
  const [sessions,  setSessions]  = useState<ActiveSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [elapsed,   setElapsed]   = useState(0); // for live elapsed time updates

  const fetchSessions = useCallback(async () => {
    const qs = new URLSearchParams();
    if (branchFilter) qs.set("branch_id", branchFilter);
    try {
      const r = await fetch(`/api/pos/active-sessions?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!r.ok) return;
      const j = await r.json();
      setSessions(j.data ?? []);
      setFetchedAt(new Date());
    } catch { /* network error — keep existing data */ }
    finally { setLoading(false); }
  }, [branchFilter, token]);

  // Initial + branch-change fetch
  useEffect(() => {
    setLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchSessions, 30_000);
    return () => clearInterval(t);
  }, [fetchSessions]);

  // Live elapsed time tick every 60s (just re-renders labels)
  useEffect(() => {
    const t = setInterval(() => setElapsed(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Client-side search filter
  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.roomName.toLowerCase().includes(q) ||
      s.reservationNo.toLowerCase().includes(q) ||
      (s.customerName ?? "").toLowerCase().includes(q)
    );
  });

  const showBranch = isSuperUser && !branchFilter;

  const handleOpen = (s: ActiveSession) => {
    navigate(`/pos?reservationId=${encodeURIComponent(s.reservationId)}`);
  };

  // Suppress unused variable warning for elapsed
  void elapsed;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f3f4f6", margin: 0 }}>
            Point of Sale
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Select an active session to open the bill</p>
        </div>

        {/* Branch selector or badge */}
        {isSuperUser ? (
          <div>
            <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 5 }}>Branch</p>
            <Select value={branchFilter || "__all__"} onValueChange={v => setBranchFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-52 bg-black/30 border-white/10 h-10">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 9,
            background: "rgba(209,174,56,0.1)", color: "#D1AE38",
            border: "1px solid rgba(209,174,56,0.25)",
          }}>
            {branches.find(b => b.id === user?.branchId)?.name ?? "My Branch"}
          </span>
        )}
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by room name, booking #, or customer…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "11px 40px 11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, fontSize: 14, color: "#e5e7eb", outline: "none",
            minHeight: 44,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(209,174,56,0.4)"; }}
          onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#6b7280", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Sessions grid ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "64px 24px", textAlign: "center" }}>
          <Mic size={36} color="#374151" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
            No active sessions right now
          </p>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            {search ? "No sessions match your search." : "All rooms are currently available."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {filtered.map(s => (
            <SessionCard
              key={s.reservationId}
              session={s}
              showBranch={showBranch}
              onOpen={() => handleOpen(s)}
            />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#4b5563" }}>
          Showing {filtered.length} active session{filtered.length !== 1 ? "s" : ""}
          {sessions.length !== filtered.length ? ` (${sessions.length} total)` : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#4b5563" }}>
            {fetchedAt ? `Updated: just now (auto-refresh 30s)` : "Loading…"}
          </span>
          <button
            onClick={() => { setLoading(true); fetchSessions(); }}
            title="Refresh now"
            style={{
              background: "none", border: "none", color: "#6b7280", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center",
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
