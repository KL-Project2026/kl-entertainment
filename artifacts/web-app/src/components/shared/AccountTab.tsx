import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "../../lib/utils";

const fmt = (amount: number | string | null | undefined, currency = "MYR") =>
  formatCurrency(parseFloat(String(amount ?? 0)), currency);

const SCard: React.FC<{ label: string; value: string | number; color?: string; sub?: string }> = ({
  label, value, color = "#111827", sub,
}) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 10, padding: "14px 18px", minWidth: 120 }}>
    <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase",
      letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{sub}</div>}
  </div>
);

const IBadge: React.FC<{ status: string }> = ({ status }) => {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    paid:           { bg: "#dcfce7", color: "#166534",  label: "Paid" },
    partially_paid: { bg: "#fef9c3", color: "#854d0e",  label: "Part Paid" },
    issued:         { bg: "#dbeafe", color: "#1e40af",  label: "Issued" },
    draft:          { bg: "#f3f4f6", color: "#6b7280",  label: "Draft" },
    void:           { bg: "#fee2e2", color: "#991b1b",  label: "Void" },
    pending:        { bg: "#fef9c3", color: "#854d0e",  label: "Pending" },
    settled:        { bg: "#dcfce7", color: "#166534",  label: "Settled" },
  };
  const s = m[status] ?? { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px",
      borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
  );
};

// ── CustomerAccountTab ──────────────────────────────────────────────
interface CustomerAccountTabProps { customerId: string }
export const CustomerAccountTab: React.FC<CustomerAccountTabProps> = ({ customerId }) => {
  const [data,     setData]    = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvs]    = useState<Record<string, unknown>[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts/customer/${customerId}`).then(r => r.json()),
      fetch(`/api/invoices/customer/${customerId}`).then(r => r.json()),
    ]).then(([sum, invs]) => {
      setData(sum.data ?? sum);
      setInvs(invs.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Total Visits"  value={String(data?.total_visits ?? 0)} />
        <SCard label="Total Spent"   value={fmt(data?.total_spent as number)} color="#D1AE38" />
        <SCard label="Avg Session"   value={fmt(data?.avg_session as number)} />
        <SCard label="Outstanding"   value={fmt(data?.outstanding as number)}
          color={(data?.outstanding as number) > 0 ? "#dc2626" : "#166534"} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "#374151" }}>
        Invoice History ({invoices.length})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            {["Invoice No", "Date", "Amount", "Status", ""].map(h => (
              <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280",
                textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em",
                fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {invoices.length === 0
              ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>None</td></tr>
              : invoices.map(inv => (
                <tr key={String(inv.id)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>
                    {String(inv.invoice_no ?? "—")}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {formatDate(inv.issued_at as string)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                    {fmt(inv.total_amount as number, String(inv.currency ?? "MYR"))}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <IBadge status={String(inv.status ?? "draft")} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <a href={`/invoices/${inv.id}`} style={{ fontSize: 12, color: "#6366f1" }}>View</a>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── HostessAccountTab ───────────────────────────────────────────────
interface HostessAccountTabProps { staffId: string; month?: string }
export const HostessAccountTab: React.FC<HostessAccountTabProps> = ({ staffId, month }) => {
  const currentMonth = month ?? new Date().toISOString().slice(0, 7);
  const [summary,  setSummary]  = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [payouts,  setPayouts]  = useState<Record<string, unknown>[]>([]);
  const [tab,      setTab]      = useState<"sessions" | "payouts">("sessions");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts/staff/${staffId}?month=${currentMonth}`).then(r => r.json()),
      fetch(`/api/hostess-sessions/staff/${staffId}?month=${currentMonth}`).then(r => r.json()),
      fetch(`/api/hostess-payouts/staff/${staffId}`).then(r => r.json()),
    ]).then(([sumJson, sessJson, paysJson]) => {
      const d = sumJson.data ?? {};
      setSummary({ ...(d.sessions ?? {}), pending_payout: d.pending_payout });
      setSessions(sessJson.data ?? []);
      setPayouts(paysJson.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [staffId, currentMonth]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <SCard label="Month Sessions" value={String(summary?.month_sessions ?? 0)} />
        <SCard label="Month Gross"    value={fmt(summary?.month_gross as number)} color="#D1AE38" />
        <SCard label="Month Payout"   value={fmt(summary?.month_payout as number)} color="#166534" />
        <SCard label="Pending"        value={fmt(summary?.pending_payout as number)}
          color={(summary?.pending_payout as number) > 0 ? "#dc2626" : "#166534"} />
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
        {([["sessions", "Sessions"], ["payouts", "Payouts"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 16px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === k ? "#D1AE38" : "transparent"}`,
            marginBottom: -2, fontSize: 13, fontWeight: tab === k ? 600 : 400,
            color: tab === k ? "#D1AE38" : "#6b7280", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {tab === "sessions" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f9fafb" }}>
              {["Date", "Type", "Hours", "Gross", "Rate", "Payout", "Commission"].map(h => (
                <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280",
                  textAlign: "left", textTransform: "uppercase", fontWeight: 600,
                  borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.length === 0
                ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>None</td></tr>
                : sessions.map(s => (
                  <tr key={String(s.id)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 10px", fontSize: 13 }}>
                      {formatDate(s.start_at as string)}</td>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        background: s.session_type === "outcall" ? "#fef9c3" : "#dbeafe",
                        color: s.session_type === "outcall" ? "#854d0e" : "#1e40af",
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      }}>{s.session_type === "outcall" ? "Out-Call" : "In-Call"}</span>
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 13 }}>
                      {s.hours_worked ? `${parseFloat(String(s.hours_worked)).toFixed(1)}h` : "—"}</td>
                    <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600 }}>
                      {fmt(s.gross_amount as number)}</td>
                    <td style={{ padding: "10px 10px", fontSize: 13, color: "#6b7280" }}>
                      {String(s.payout_rate ?? "—")}%</td>
                    <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, color: "#166534" }}>
                      {fmt(s.net_payout as number)}</td>
                    <td style={{ padding: "10px 10px", fontSize: 13, color: "#dc2626" }}>
                      {(s.agent_commission as number) > 0 ? fmt(s.agent_commission as number) : "—"}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === "payouts" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f9fafb" }}>
              {["Period", "Sessions", "Payout", "Status", "Paid At"].map(h => (
                <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280",
                  textAlign: "left", textTransform: "uppercase", fontWeight: 600,
                  borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {payouts.length === 0
                ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>None</td></tr>
                : payouts.map(p => (
                  <tr key={String(p.id)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      {formatDate(p.period_from as string)} ~ {formatDate(p.period_to as string)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      {String(p.total_sessions ?? 0)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#166534" }}>
                      {fmt(p.total_payout as number)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <IBadge status={String(p.status ?? "pending")} /></td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280" }}>
                      {formatDate(p.paid_at as string)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── AgentAccountTab ─────────────────────────────────────────────────
interface AgentAccountTabProps { agentId: string; month?: string }
export const AgentAccountTab: React.FC<AgentAccountTabProps> = ({ agentId, month }) => {
  const currentMonth = month ?? new Date().toISOString().slice(0, 7);
  const [summary, setSummary]   = useState<Record<string, unknown> | null>(null);
  const [comms,   setComms]     = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts/agent/${agentId}?month=${currentMonth}`).then(r => r.json()),
      fetch(`/api/agent-commissions/agent/${agentId}`).then(r => r.json()),
    ]).then(([sumJson, cJson]) => {
      setSummary(sumJson.data ?? sumJson);
      setComms(cJson.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agentId, currentMonth]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Hostesses"     value={String(summary?.hostess_count ?? 0)} />
        <SCard label="Month Comm."   value={fmt(summary?.month_commission as number)} color="#D1AE38" />
        <SCard label="Pending"       value={fmt(summary?.pending_commission as number)}
          color={(summary?.pending_commission as number) > 0 ? "#dc2626" : "#166534"} />
        <SCard label="Total Earned"  value={fmt(summary?.total_commission as number)} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            {["Date", "Hostess", "Base Amount", "Rate", "Commission", "Status"].map(h => (
              <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280",
                textAlign: "left", textTransform: "uppercase", fontWeight: 600,
                borderBottom: "1px solid #e5e7eb" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {comms.length === 0
              ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>None</td></tr>
              : comms.map(c => (
                <tr key={String(c.id)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {formatDate(c.created_at as string)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {String(c.hostess_name ?? c.hostess_id ?? "—")}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {fmt(c.base_amount as number)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {c.commission_type === "percentage"
                      ? `${c.rate}%`
                      : fmt(c.rate as number)
                    }</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#166534" }}>
                    {fmt(c.commission_amount as number)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <IBadge status={String(c.status ?? "pending")} /></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── StaffAccountTab ─────────────────────────────────────────────────
interface StaffAccountTabProps { staffId: string; month?: string }
export const StaffAccountTab: React.FC<StaffAccountTabProps> = ({ staffId, month }) => {
  const currentMonth = month ?? new Date().toISOString().slice(0, 7);
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/staff/${staffId}?month=${currentMonth}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [staffId, currentMonth]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

  const attendance = (data?.attendance ?? {}) as Record<string, unknown>;
  const sessions   = (data?.sessions   ?? {}) as Record<string, unknown>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>
        Attendance — {currentMonth}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Present"    value={`${attendance.present_days ?? 0}d`} />
        <SCard label="Hours"      value={`${attendance.total_hours ?? 0}h`} color="#D1AE38" />
        <SCard label="Late"       value={`${attendance.late_days ?? 0}d`}
          color={(attendance.late_days as number) > 0 ? "#dc2626" : "#111827"} />
        <SCard label="Absent"     value={`${attendance.absent_days ?? 0}d`}
          color={(attendance.absent_days as number) > 0 ? "#dc2626" : "#111827"} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>
        Sessions
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Sessions"   value={String(sessions.month_sessions ?? 0)} />
        <SCard label="Gross"      value={fmt(sessions.month_gross as number)} color="#D1AE38" />
        <SCard label="Payout"     value={fmt(sessions.month_payout as number)} color="#166534" />
        <SCard label="Pending"    value={fmt(data?.pending_payout as number)}
          color={(data?.pending_payout as number) > 0 ? "#dc2626" : "#166534"} />
      </div>
      <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 8 }}>
        Detailed payment records are available in the Payments menu.
      </div>
    </div>
  );
};

// ── RoomAccountTab ──────────────────────────────────────────────────
interface RoomAccountTabProps { roomId: string }
export const RoomAccountTab: React.FC<RoomAccountTabProps> = ({ roomId }) => {
  const [blocks,  setBlocks]  = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch(`/api/availability/blocks?entity_type=room&entity_id=${roomId}&date=${today}`)
      .then(r => r.json())
      .then(d => { setBlocks(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [roomId, today]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

  const booked = blocks.filter(b => b.block_type === "booked").length;
  const totalHours = booked;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Bookings Today"  value={booked} />
        <SCard label="Hours Booked"    value={`${totalHours}h`} color="#D1AE38" />
        <SCard label="Blocks Today"    value={blocks.filter(b => b.block_type !== "booked").length} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            {["Time", "Type", "Notes"].map(h => (
              <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280",
                textAlign: "left", textTransform: "uppercase", fontWeight: 600,
                borderBottom: "1px solid #e5e7eb" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {blocks.length === 0
              ? <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
                  No blocks today</td></tr>
              : blocks.map(b => (
                <tr key={String(b.id)} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "monospace" }}>
                    {new Date(b.start_dt as string).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                    {" → "}
                    {new Date(b.end_dt as string).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      background: b.block_type === "booked" ? "#dbeafe" : "#fef9c3",
                      color: b.block_type === "booked" ? "#1e40af" : "#854d0e",
                      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    }}>{String(b.block_type ?? "—").replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
                    {String(b.notes ?? "—")}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: "12px 0 0" }}>
        Revenue reports are available in the Reports menu.
      </div>
    </div>
  );
};

export default CustomerAccountTab;
