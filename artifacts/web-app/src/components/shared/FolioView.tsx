import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDate } from "../../lib/utils";

interface FolioEntry {
  id: string;
  entry_type: string;
  description: string | null;
  quantity: number;
  unit_price: number | null;
  amount: number;
  currency: string;
  is_void: boolean;
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

export const FolioView: React.FC<FolioViewProps> = ({
  reservationId, currency = "MYR", isLive = false, onEntryAdded,
}) => {
  const [entries, setEntries] = useState<FolioEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState<{
    show: boolean; entry_type: string; description: string; quantity: string; unit_price: string; amount: string;
  }>({ show: false, entry_type: "room_charge", description: "", quantity: "1", unit_price: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/folio/${reservationId}`)
      .then(r => r.json())
      .then(d => {
        const data = d.data ?? d;
        setEntries(data.entries ?? []);
        setTotal(parseFloat(String(data.total ?? 0)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [reservationId]);

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
      const amt = addForm.amount
        ? parseFloat(addForm.amount)
        : up ? up * qty : 0;
      const r = await fetch("/api/folio/entries", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
      load();
      onEntryAdded?.();
    } catch (e) { setSaveErr((e as Error).message); } finally { setSaving(false); }
  };

  const voidEntry = async (id: string) => {
    if (!window.confirm("Void this entry?")) return;
    await fetch(`/api/folio/entries/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return (
    <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Folio ({entries.length} items)
          {isLive && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>auto-refresh 30s</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setAddForm(p => ({ ...p, show: !p.show }))}
            style={{ padding: "6px 12px", background: "#D1AE38", color: "#fff",
              border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Add Entry
          </button>
          <button onClick={load}
            style={{ padding: "6px 12px", background: "#f3f4f6",
              border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
            ↻
          </button>
        </div>
      </div>

      {/* Quick add form */}
      {addForm.show && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
          padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>TYPE</div>
              <select value={addForm.entry_type}
                onChange={e => setAddForm(p => ({ ...p, entry_type: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: 13 }}>
                {Object.entries(ENTRY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>DESCRIPTION</div>
              <input value={addForm.description}
                onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>QTY × UNIT</div>
              <div style={{ display: "flex", gap: 4 }}>
                <input type="number" value={addForm.quantity} min="1"
                  onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))}
                  style={{ width: 48, padding: "7px 6px", border: "1px solid #d1d5db",
                    borderRadius: 6, fontSize: 13 }} />
                <input type="number" value={addForm.unit_price}
                  onChange={e => setAddForm(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="Unit price"
                  style={{ flex: 1, padding: "7px 10px", border: "1px solid #d1d5db",
                    borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>TOTAL AMOUNT</div>
              <input type="number" value={addForm.amount}
                onChange={e => setAddForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Override total"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <button onClick={addEntry} disabled={saving}
              style={{ padding: "8px 14px", background: saving ? "#9ca3af" : "#374151",
                color: "#fff", border: "none", borderRadius: 6, fontSize: 13,
                fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "..." : "Add"}
            </button>
          </div>
          {saveErr && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>⚠ {saveErr}</div>}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Type", "Description", "Qty", "Unit Price", "Amount", ""].map(h => (
                <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280",
                  textAlign: h === "Amount" ? "right" : "left", textTransform: "uppercase",
                  letterSpacing: "0.06em", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>
                No items</td></tr>
            ) : entries.map(e => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280",
                    padding: "1px 6px", borderRadius: 4 }}>
                    {ENTRY_LABELS[e.entry_type] ?? e.entry_type}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 13 }}>{e.description ?? "—"}</td>
                <td style={{ padding: "8px 10px", fontSize: 13, textAlign: "center" }}>{e.quantity}</td>
                <td style={{ padding: "8px 10px", fontSize: 13 }}>
                  {e.unit_price != null ? formatCurrency(e.unit_price, currency) : "—"}</td>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>
                  {e.entry_type === "discount"
                    ? <span style={{ color: "#dc2626" }}>-{formatCurrency(e.amount, currency)}</span>
                    : formatCurrency(e.amount, currency)
                  }
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <button onClick={() => voidEntry(e.id)}
                    title="Void" style={{ background: "none", border: "none",
                      color: "#9ca3af", fontSize: 13, cursor: "pointer", padding: "2px 6px" }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
              <td colSpan={5} style={{ padding: "12px 10px", fontWeight: 700,
                fontSize: 14, textAlign: "right" }}>Total</td>
              <td style={{ padding: "12px 10px", fontWeight: 700,
                fontSize: 16, textAlign: "right", color: "#D1AE38" }}>
                {formatCurrency(total, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default FolioView;
