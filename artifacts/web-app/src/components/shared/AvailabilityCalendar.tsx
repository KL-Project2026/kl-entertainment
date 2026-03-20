import React, { useState, useEffect, useCallback } from "react";

interface AvailabilityBlock {
  id: string;
  block_type: string;
  start_dt: string;
  end_dt: string;
  reservation_id: string | null;
  reservation_no: string | null;
  notes: string | null;
}

interface AvailabilityCalendarProps {
  entityType: string;
  entityId: string;
  branchId?: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  available:   { bg: "#dcfce7", color: "#166534", label: "Available" },
  booked:      { bg: "#dbeafe", color: "#1e40af", label: "Booked" },
  occupied:    { bg: "#fee2e2", color: "#991b1b", label: "Occupied" },
  maintenance: { bg: "#fef9c3", color: "#854d0e", label: "Maintenance" },
  closed:      { bg: "#f3f4f6", color: "#6b7280", label: "Closed" },
};

const ipt: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: 14, color: "#111827", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
};

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  entityType, entityId, branchId,
}) => {
  const [date,    setDate]    = useState(new Date().toISOString().split("T")[0]);
  const [blocks,  setBlocks]  = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ block_type: "maintenance", start_time: "10:00", end_time: "12:00", notes: "" });
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ entity_type: entityType, entity_id: entityId, date });
    fetch(`/api/availability/blocks?${q}`)
      .then(r => r.json())
      .then(d => { setBlocks(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [entityType, entityId, date]);

  useEffect(() => { load(); }, [load]);

  const getStatus = (hour: number) => {
    const s = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
    const e = new Date(s.getTime() + 3_600_000);
    for (const b of blocks) {
      if (new Date(b.start_dt) < e && new Date(b.end_dt) > s) return b.block_type;
    }
    return "available";
  };

  const getBlock = (hour: number) => {
    const s = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
    const e = new Date(s.getTime() + 3_600_000);
    return blocks.find(b => new Date(b.start_dt) < e && new Date(b.end_dt) > s);
  };

  const addBlock = async () => {
    setSaving(true); setSaveErr(null);
    try {
      const startDt = `${date}T${form.start_time}:00`;
      const endDt   = `${date}T${form.end_time}:00`;
      const ck = await fetch("/api/availability/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, start_dt: startDt, end_dt: endDt }),
      });
      const ckd = await ck.json();
      if (!ckd.available) throw new Error(ckd.message ?? "Time slot conflict");
      const r = await fetch("/api/availability/blocks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType, entity_id: entityId, branch_id: branchId,
          block_type: form.block_type, start_dt: startDt, end_dt: endDt, notes: form.notes,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      setModal(false); load();
    } catch (e) { setSaveErr((e as Error).message); } finally { setSaving(false); }
  };

  const removeBlock = async (id: string) => {
    if (!window.confirm("Remove this block?")) return;
    await fetch(`/api/availability/blocks/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <span key={k} style={{ background: v.bg, color: v.color,
              padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{v.label}</span>
          ))}
        </div>
        <button onClick={() => setModal(true)}
          style={{ padding: "8px 16px", background: "#374151", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Block
        </button>
      </div>

      {/* 24-hour grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {Array.from({ length: 24 }, (_, i) => {
            const st = getStatus(i);
            const sc = STATUS_COLORS[st] ?? STATUS_COLORS.available;
            const bl = getBlock(i);
            return (
              <div key={i} style={{ background: sc.bg, color: sc.color,
                borderRadius: 8, padding: "10px 8px", textAlign: "center",
                position: "relative", border: `1px solid ${sc.bg}` }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{String(i).padStart(2, "0")}:00</div>
                <div style={{ fontSize: 10, marginTop: 3, fontWeight: 500 }}>{sc.label}</div>
                {bl && bl.block_type !== "booked" && (
                  <button onClick={() => removeBlock(bl.id)}
                    style={{ position: "absolute", top: 2, right: 4,
                      background: "none", border: "none", color: sc.color,
                      fontSize: 12, cursor: "pointer", padding: 0, lineHeight: 1 }}
                    title="Remove">✕</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Booked list */}
      {blocks.filter(b => b.block_type === "booked").length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
            Reservations
          </div>
          {blocks.filter(b => b.block_type === "booked").map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", background: "#f0f4ff", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                {new Date(b.start_dt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                {" → "}
                {new Date(b.end_dt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {b.reservation_id && (
                <a href={`/reservations/${b.reservation_id}`} style={{ color: "#6366f1", fontSize: 12 }}>
                  {b.reservation_no ?? `#${b.reservation_id.slice(0, 8)}`}
                </a>
              )}
              {b.notes && <span style={{ color: "#6b7280", fontSize: 12 }}>{b.notes}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Add block modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 360, maxWidth: "90vw" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600 }}>Add Time Block</h3>
            <label style={lbl}>Block Type</label>
            <select value={form.block_type}
              onChange={e => setForm(p => ({ ...p, block_type: e.target.value }))}
              style={{ ...ipt, marginBottom: 12 }}>
              <option value="maintenance">Maintenance / Cleaning</option>
              <option value="closed">Closed</option>
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "0 0 12px" }}>
              <div>
                <label style={lbl}>Start</label>
                <input type="time" value={form.start_time}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={ipt} />
              </div>
              <div>
                <label style={lbl}>End</label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={ipt} />
              </div>
            </div>
            <label style={lbl}>Notes</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Regular cleaning" style={{ ...ipt, marginBottom: 16 }} />
            {saveErr && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>⚠ {saveErr}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setModal(false); setSaveErr(null); }}
                style={{ padding: "8px 16px", background: "#fff", color: "#374151",
                  border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={addBlock} disabled={saving}
                style={{ padding: "8px 16px", background: saving ? "#a5b4fc" : "#D1AE38",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 13,
                  fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
