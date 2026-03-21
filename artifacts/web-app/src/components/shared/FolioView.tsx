import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../../lib/utils";
import { useAuthStore } from "../../lib/auth";

interface FolioEntry {
  id: string;
  entry_type: string;
  description: string | null;
  quantity: number;
  unit_price: number | null;
  amount: number;
  currency: string;
  is_void: boolean;
  order_status: "pending" | "served";
}

interface FolioViewProps {
  reservationId: string;
  currency?: string;
  isLive?: boolean;
  onEntryAdded?: () => void;
}

const ENTRY_LABELS: Record<string, string> = {
  room_charge:     "Room Charge",
  pos_item:        "POS",
  hostess_charge:  "Hostess",
  outcall_fee:     "Out-Call",
  late_charge:     "Late Charge",
  sst:             "SST",
  service_charge:  "Service Charge",
  discount:        "Discount",
  other:           "Other",
};

const ENTRY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  room_charge:     { bg: "rgba(59,130,246,0.15)",   text: "#93c5fd", border: "rgba(59,130,246,0.3)" },
  pos_item:        { bg: "rgba(168,85,247,0.15)",   text: "#c4b5fd", border: "rgba(168,85,247,0.3)" },
  hostess_charge:  { bg: "rgba(236,72,153,0.15)",   text: "#f9a8d4", border: "rgba(236,72,153,0.3)" },
  outcall_fee:     { bg: "rgba(251,146,60,0.15)",   text: "#fdba74", border: "rgba(251,146,60,0.3)" },
  late_charge:     { bg: "rgba(251,191,36,0.15)",   text: "#fde68a", border: "rgba(251,191,36,0.3)" },
  sst:             { bg: "rgba(20,184,166,0.15)",   text: "#5eead4", border: "rgba(20,184,166,0.3)" },
  service_charge:  { bg: "rgba(16,185,129,0.15)",   text: "#6ee7b7", border: "rgba(16,185,129,0.3)" },
  discount:        { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "rgba(239,68,68,0.3)" },
  other:           { bg: "rgba(107,114,128,0.15)",  text: "#d1d5db", border: "rgba(107,114,128,0.3)" },
};

export const FolioView: React.FC<FolioViewProps> = ({
  reservationId, currency = "MYR", isLive = false, onEntryAdded,
}) => {
  const { token } = useAuthStore();
  const [entries, setEntries]     = useState<FolioEntry[]>([]);
  const [total,   setTotal]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving,  setSaving]      = useState(false);
  const [saveErr, setSaveErr]     = useState<string | null>(null);
  const [toggling, setToggling]   = useState<string | null>(null);
  const [addForm, setAddForm]     = useState({
    entry_type: "room_charge", description: "", quantity: "1",
    unit_price: "", amount: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/folio/${reservationId}`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then(r => r.json())
      .then(d => {
        const data = d.data ?? d;
        setEntries(data.entries ?? []);
        setTotal(parseFloat(String(data.total ?? 0)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [reservationId, token]);

  useEffect(() => {
    load();
    if (isLive) {
      const t = setInterval(load, 30_000);
      return () => clearInterval(t);
    }
    return undefined;
  }, [load, isLive]);

  const addEntry = async () => {
    setSaving(true); setSaveErr(null);
    try {
      const qty = parseFloat(addForm.quantity) || 1;
      const up  = parseFloat(addForm.unit_price) || null;
      const amt = addForm.amount ? parseFloat(addForm.amount) : up ? up * qty : 0;
      const r = await fetch("/api/folio/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          entry_type:     addForm.entry_type,
          description:    addForm.description || null,
          quantity:       qty,
          unit_price:     up,
          amount:         amt,
          currency,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to add entry");
      setAddForm(p => ({ ...p, show: false, description: "", unit_price: "", amount: "" }));
      setShowForm(false);
      load();
      onEntryAdded?.();
    } catch (e) { setSaveErr((e as Error).message); } finally { setSaving(false); }
  };

  const voidEntry = async (id: string) => {
    if (!window.confirm("Void this order entry?")) return;
    await fetch(`/api/folio/entries/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    load();
  };

  const toggleStatus = async (entry: FolioEntry) => {
    setToggling(entry.id);
    const next = entry.order_status === "pending" ? "served" : "pending";
    try {
      await fetch(`/api/folio/entries/${entry.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ order_status: next }),
      });
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, order_status: next } : e));
    } finally { setToggling(null); }
  };

  const pendingCount = entries.filter(e => e.order_status === "pending").length;
  const servedCount  = entries.filter(e => e.order_status === "served").length;

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
      Loading orders…
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
            Orders ({entries.length})
          </span>
          {isLive && (
            <span style={{ fontSize: 11, color: "#6b7280", background: "rgba(255,255,255,0.04)",
              padding: "2px 7px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)" }}>
              auto-refresh 30s
            </span>
          )}
          {/* Summary pills */}
          {entries.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9,
                background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                {pendingCount} Pending
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9,
                background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
                {servedCount} Served
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowForm(p => !p); setSaveErr(null); }}
            style={{ padding: "7px 14px", background: "rgba(209,174,56,0.9)", color: "#0a0a0a",
              border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.02em" }}>
            + Add Order
          </button>
          <button onClick={load}
            style={{ padding: "7px 11px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, fontSize: 13,
              color: "#9ca3af", cursor: "pointer" }}>
            ↻
          </button>
        </div>
      </div>

      {/* ── Add order form ── */}
      {showForm && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12,
            letterSpacing: "0.08em", textTransform: "uppercase" }}>
            New Order Entry
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 80px 1fr 1fr", gap: 10, alignItems: "end" }}>
            {/* Type */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" }}>Type</div>
              <select value={addForm.entry_type}
                onChange={e => setAddForm(p => ({ ...p, entry_type: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, fontSize: 13, color: "#e5e7eb", outline: "none" }}>
                {Object.entries(ENTRY_LABELS).map(([k, v]) => (
                  <option key={k} value={k} style={{ background: "#1a1a1a" }}>{v}</option>
                ))}
              </select>
            </div>
            {/* Description */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" }}>Description</div>
              <input value={addForm.description}
                onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Item description"
                style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, fontSize: 13, color: "#e5e7eb", outline: "none" }} />
            </div>
            {/* Qty */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" }}>Qty</div>
              <input type="number" value={addForm.quantity} min="1"
                onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, fontSize: 13, color: "#e5e7eb", outline: "none" }} />
            </div>
            {/* Unit Price */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" }}>Unit Price (MYR)</div>
              <input type="number" value={addForm.unit_price}
                onChange={e => setAddForm(p => ({ ...p, unit_price: e.target.value }))}
                placeholder="0.00"
                style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, fontSize: 13, color: "#e5e7eb", outline: "none" }} />
            </div>
            {/* Override Total */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" }}>Total (Override)</div>
              <input type="number" value={addForm.amount}
                onChange={e => setAddForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Auto"
                style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 7, fontSize: 13, color: "#e5e7eb", outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setShowForm(false); setSaveErr(null); }}
              style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, fontSize: 13,
                color: "#9ca3af", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={addEntry} disabled={saving}
              style={{ padding: "7px 18px",
                background: saving ? "rgba(209,174,56,0.4)" : "rgba(209,174,56,0.9)",
                color: "#0a0a0a", border: "none", borderRadius: 7, fontSize: 13,
                fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Adding…" : "Add Order"}
            </button>
          </div>
          {saveErr && (
            <div style={{ fontSize: 12, color: "#f87171", marginTop: 8, padding: "6px 10px",
              background: "rgba(239,68,68,0.1)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
              ⚠ {saveErr}
            </div>
          )}
        </div>
      )}

      {/* ── Order table ── */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
        <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { label: "Status",      align: "left"  },
                { label: "Type",        align: "left"  },
                { label: "Description", align: "left"  },
                { label: "Qty",         align: "center" },
                { label: "Unit Price",  align: "right" },
                { label: "Amount",      align: "right" },
                { label: "",            align: "right" },
              ].map(h => (
                <th key={h.label} style={{
                  padding: "9px 12px", fontSize: 10, color: "#6b7280", fontWeight: 700,
                  textAlign: h.align as React.CSSProperties["textAlign"],
                  textTransform: "uppercase", letterSpacing: "0.07em",
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center",
                  color: "#4b5563", fontSize: 13 }}>
                  No orders yet — use "+ Add Order" to start
                </td>
              </tr>
            ) : entries.map((e, idx) => {
              const typeStyle = ENTRY_COLORS[e.entry_type] ?? ENTRY_COLORS.other;
              const isPending  = e.order_status === "pending";
              const isToggling = toggling === e.id;
              return (
                <tr key={e.id} style={{
                  borderBottom: idx < entries.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  background: isPending ? "rgba(251,191,36,0.02)" : "transparent",
                  transition: "background 0.15s",
                }}>
                  {/* Status badge — clickable toggle */}
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => toggleStatus(e)}
                      disabled={isToggling}
                      title={isPending ? "Click to mark as Served" : "Click to mark as Pending"}
                      style={{
                        padding: "3px 9px", borderRadius: 9, fontSize: 11, fontWeight: 700,
                        cursor: isToggling ? "wait" : "pointer", border: "none",
                        letterSpacing: "0.04em", transition: "all 0.15s",
                        background: isPending ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.15)",
                        color:       isPending ? "#fbbf24"               : "#4ade80",
                        boxShadow:   isPending
                          ? "0 0 0 1px rgba(251,191,36,0.3)"
                          : "0 0 0 1px rgba(34,197,94,0.3)",
                        opacity: isToggling ? 0.6 : 1,
                      }}>
                      {isToggling ? "…" : isPending ? "Pending" : "Served"}
                    </button>
                  </td>
                  {/* Entry type */}
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                      background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}`,
                    }}>
                      {ENTRY_LABELS[e.entry_type] ?? e.entry_type}
                    </span>
                  </td>
                  {/* Description */}
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#d1d5db" }}>
                    {e.description ?? <span style={{ color: "#4b5563" }}>—</span>}
                  </td>
                  {/* Qty */}
                  <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "center", color: "#9ca3af" }}>
                    {e.quantity}
                  </td>
                  {/* Unit price */}
                  <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", color: "#9ca3af" }}>
                    {e.unit_price != null ? formatCurrency(e.unit_price, currency) : <span style={{ color: "#4b5563" }}>—</span>}
                  </td>
                  {/* Amount */}
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, textAlign: "right" }}>
                    {e.entry_type === "discount"
                      ? <span style={{ color: "#f87171" }}>-{formatCurrency(e.amount, currency)}</span>
                      : <span style={{ color: "#e5e7eb" }}>{formatCurrency(e.amount, currency)}</span>
                    }
                  </td>
                  {/* Void button */}
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button onClick={() => voidEntry(e.id)} title="Void entry"
                      style={{ background: "none", border: "none", color: "#4b5563",
                        fontSize: 14, cursor: "pointer", padding: "2px 6px",
                        borderRadius: 4, transition: "color 0.15s" }}
                      onMouseEnter={ev => { (ev.target as HTMLButtonElement).style.color = "#f87171"; }}
                      onMouseLeave={ev => { (ev.target as HTMLButtonElement).style.color = "#4b5563"; }}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Total footer */}
          {entries.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                <td colSpan={5} style={{ padding: "13px 12px", fontWeight: 600, fontSize: 13,
                  textAlign: "right", color: "#6b7280", textTransform: "uppercase",
                  letterSpacing: "0.06em" }}>
                  Total
                </td>
                <td style={{ padding: "13px 12px", fontWeight: 800, fontSize: 16,
                  textAlign: "right", color: "#D1AE38" }}>
                  {formatCurrency(total, currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default FolioView;
