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
    present:     { bg: "#dcfce7", color: "#166534", label: "Present" },
    absent:      { bg: "#fee2e2", color: "#991b1b", label: "Absent" },
    late:        { bg: "#fef9c3", color: "#854d0e", label: "Late" },
    half_day:    { bg: "#fde8d8", color: "#9a3412", label: "Half Day" },
    day_off:     { bg: "#f3f4f6", color: "#6b7280", label: "Day Off" },
    early_leave: { bg: "#fde8d8", color: "#9a3412", label: "Early Leave" },
  };
  const s = map[status] ?? { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px",
      borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
  );
};

const SCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = "#111827" }) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "14px 18px", minWidth: 110 }}>
    <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase",
      letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
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
      const list: AttendanceRecord[] = recJson.data ?? [];
      setRecords(list);
      setSummary(sumJson.data ?? null);
      setToday(todJson.data ?? null);
    } catch {
      setErr("데이터 로드 실패");
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
      if (!r.ok) throw new Error(d.error ?? "출근 처리 실패");
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
      if (!r.ok) throw new Error(d.error ?? "퇴근 처리 실패");
      load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
  );

  return (
    <div style={{ padding: "4px 0" }}>
      {/* 오늘 출퇴근 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        background: "#f9fafb", borderRadius: 10, padding: "14px 18px",
        marginBottom: 20, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            Today's Attendance
          </div>
          {today ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              In: {fmtTime(today.clock_in)}
              {today.clock_out && <> · Out: {fmtTime(today.clock_out)} · {today.hours_worked ?? 0}h</>}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>No clock-in record today</div>
          )}
        </div>
        {err && <span style={{ fontSize: 12, color: "#dc2626" }}>⚠ {err}</span>}
        {!today && (
          <button onClick={clockIn} disabled={busy} style={{
            padding: "9px 18px", background: "#D1AE38", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>{busy ? "Processing..." : "▶ Clock In"}</button>
        )}
        {isClockedIn && (
          <button onClick={clockOut} disabled={busy} style={{
            padding: "9px 18px", background: "#374151", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          }}>{busy ? "Processing..." : "■ Clock Out"}</button>
        )}
        {today && !isClockedIn && (
          <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>✓ Clocked Out</span>
        )}
      </div>

      {/* 요약 카드 */}
      <div style={{ display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <SCard label="Present" value={`${summary?.present_days ?? 0}d`} />
          <SCard label="Hours" value={`${summary?.total_hours ?? 0}h`} color="#D1AE38" />
          <SCard label="Late" value={`${summary?.late_days ?? 0}d`}
            color={(summary?.late_days ?? 0) > 0 ? "#dc2626" : "#111827"} />
          <SCard label="Absent" value={`${summary?.absent_days ?? 0}d`}
            color={(summary?.absent_days ?? 0) > 0 ? "#dc2626" : "#111827"} />
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb",
            borderRadius: 8, fontSize: 13, outline: "none" }} />
      </div>

      {/* 기록 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Date", "In", "Out", "Hours", "Late (min)", "Status", "Notes"].map(h => (
                <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280",
                  textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em",
                  fontWeight: 600, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
                No records</td></tr>
            ) : records.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500 }}>
                  {formatDate(r.work_date)}</td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>{fmtTime(r.clock_in)}</td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                  {r.clock_out
                    ? fmtTime(r.clock_out)
                    : r.status === "present"
                      ? <span style={{ color: "#D1AE38", fontWeight: 600 }}>On Shift</span>
                      : "—"
                  }
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                  {r.hours_worked != null ? `${r.hours_worked}h` : "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 13,
                  color: (r.late_minutes ?? 0) > 0 ? "#dc2626" : "#9ca3af" }}>
                  {(r.late_minutes ?? 0) > 0 ? `${r.late_minutes}` : "—"}</td>
                <td style={{ padding: "10px 12px" }}><StatusChip status={r.status} /></td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280",
                  maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
