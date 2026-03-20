import React, { useState, useEffect, useCallback } from "react";
import { formatDate } from "../../lib/utils";

interface AttendanceRecord {
  id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  late_minutes: number | null;
  status: string;
  notes: string | null;
}

interface Summary {
  present_days: number;
  absent_days: number;
  late_days: number;
  early_leave_days: number;
  total_hours: number;
  total_penalty: number;
}

interface AttendanceTabProps {
  staffId: string;
}

const fmtTime = (v: string | null) => {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    present:     { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", label: "Present" },
    absent:      { bg: "rgba(239,68,68,0.15)",   color: "#f87171", label: "Absent" },
    late:        { bg: "rgba(234,179,8,0.15)",   color: "#facc15", label: "Late" },
    half_day:    { bg: "rgba(249,115,22,0.15)",  color: "#fb923c", label: "Half Day" },
    day_off:     { bg: "rgba(156,163,175,0.15)", color: "#9ca3af", label: "Day Off" },
    early_leave: { bg: "rgba(249,115,22,0.15)",  color: "#fb923c", label: "Early Leave" },
  };
  const s = map[status] ?? { bg: "rgba(156,163,175,0.15)", color: "#9ca3af", label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${s.color}40`,
    }}>{s.label}</span>
  );
};

const SCard: React.FC<{ label: string; value: string | number; accent?: string }> = ({ label, value, accent }) => (
  <div style={{
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "14px 18px",
    minWidth: 100,
  }}>
    <div style={{
      fontSize: 11, color: "rgba(255,255,255,0.4)",
      textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4,
    }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? "rgba(255,255,255,0.9)" }}>{value}</div>
  </div>
);

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ staffId }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [today, setToday]     = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth]     = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, sumRes, todRes] = await Promise.all([
        fetch(`/api/attendance/staff/${staffId}?month=${month}`),
        fetch(`/api/attendance/summary/${staffId}?month=${month}`),
        fetch(`/api/attendance/today/${staffId}`),
      ]);
      const [recJson, sumJson, todJson] = await Promise.all([
        recRes.json(), sumRes.json(), todRes.json(),
      ]);
      setRecords(recJson.data ?? []);
      setSummary(sumJson.data ?? null);
      setToday(todJson.data ?? null);
    } catch {
      setErr("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [staffId, month]);

  useEffect(() => { load(); }, [load]);

  const isClockedIn = !!(today?.clock_in && !today?.clock_out);

  const clockIn = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Clock-in failed");
      load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const clockOut = async () => {
    if (!today) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/attendance/${today.id}/clock-out`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Clock-out failed");
      load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ padding: "4px 0" }}>

      {/* Today's Attendance */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10, padding: "14px 18px", marginBottom: 20,
        border: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>
            Today&apos;s Attendance
          </div>
          {today ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              In: {fmtTime(today.clock_in)}
              {today.clock_out && <> · Out: {fmtTime(today.clock_out)} · {today.hours_worked ?? 0}h</>}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No record for today</div>
          )}
        </div>
        {err && <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {err}</span>}
        {!today && (
          <button onClick={clockIn} disabled={busy} style={{
            padding: "9px 18px", background: "#D1AE38", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>{busy ? "Processing..." : "▶ Clock In"}</button>
        )}
        {isClockedIn && (
          <button onClick={clockOut} disabled={busy} style={{
            padding: "9px 18px",
            background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>{busy ? "Processing..." : "■ Clock Out"}</button>
        )}
        {today && !isClockedIn && (
          <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>✓ Clocked Out</span>
        )}
      </div>

      {/* Summary Cards + Month picker */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SCard label="Present Days" value={`${summary?.present_days ?? 0}d`} />
          <SCard label="Hours Worked" value={`${summary?.total_hours ?? 0}h`} accent="#D1AE38" />
          <SCard label="Late" value={`${summary?.late_days ?? 0}d`}
            accent={(summary?.late_days ?? 0) > 0 ? "#f87171" : undefined} />
          <SCard label="Absent" value={`${summary?.absent_days ?? 0}d`}
            accent={(summary?.absent_days ?? 0) > 0 ? "#f87171" : undefined} />
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{
            padding: "8px 12px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, fontSize: 13,
            color: "rgba(255,255,255,0.85)",
            outline: "none",
            colorScheme: "dark",
          }}
        />
      </div>

      {/* Records Table */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
        <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              {["Date", "In", "Out", "Hours", "Late (min)", "Status", "Notes"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em",
                  fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{
                  padding: 32, textAlign: "center",
                  color: "rgba(255,255,255,0.3)", fontSize: 13,
                }}>No records</td>
              </tr>
            ) : records.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>
                  {formatDate(r.work_date)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {fmtTime(r.clock_in)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {r.clock_out
                    ? fmtTime(r.clock_out)
                    : r.status === "present"
                      ? <span style={{ color: "#D1AE38", fontWeight: 600 }}>On Shift</span>
                      : "—"
                  }
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                  {r.hours_worked != null ? `${r.hours_worked}h` : "—"}</td>
                <td style={{
                  padding: "10px 14px", fontSize: 13,
                  color: (r.late_minutes ?? 0) > 0 ? "#f87171" : "rgba(255,255,255,0.3)",
                }}>
                  {(r.late_minutes ?? 0) > 0 ? `${r.late_minutes}` : "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <StatusChip status={r.status} /></td>
                <td style={{
                  padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)",
                  maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTab;
