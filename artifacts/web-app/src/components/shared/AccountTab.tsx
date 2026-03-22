import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "../../lib/utils";

const fmt = (amount: number | string | null | undefined, currency = "MYR") =>
  formatCurrency(parseFloat(String(amount ?? 0)), currency);

// ── Shared primitives (dark-theme) ────────────────────────────────────
const DK = {
  cardBg:     "rgba(255,255,255,0.05)",
  cardBorder: "1px solid rgba(255,255,255,0.08)",
  theadBg:    "rgba(255,255,255,0.06)",
  rowBorder:  "1px solid rgba(255,255,255,0.06)",
  divider:    "1px solid rgba(255,255,255,0.08)",
  textPrimary:   "#e5e7eb",
  textMuted:     "#9ca3af",
  textSubtle:    "#6b7280",
};

const SCard: React.FC<{ label: string; value: string | number; color?: string; sub?: string }> = ({
  label, value, color = DK.textPrimary, sub,
}) => (
  <div style={{ background: DK.cardBg, border: DK.cardBorder,
    borderRadius: 10, padding: "14px 18px", minWidth: 120 }}>
    <div style={{ fontSize: 11, color: DK.textMuted, textTransform: "uppercase",
      letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: DK.textSubtle, marginTop: 3 }}>{sub}</div>}
  </div>
);

const IBadge: React.FC<{ status: string }> = ({ status }) => {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    paid:           { bg: "rgba(134,239,172,0.15)", color: "#86efac",  label: "Paid" },
    partially_paid: { bg: "rgba(253,224,71,0.15)",  color: "#fde047",  label: "Part Paid" },
    issued:         { bg: "rgba(147,197,253,0.15)", color: "#93c5fd",  label: "Issued" },
    draft:          { bg: "rgba(255,255,255,0.08)", color: "#9ca3af",  label: "Draft" },
    void:           { bg: "rgba(252,165,165,0.15)", color: "#fca5a5",  label: "Void" },
    pending:        { bg: "rgba(253,224,71,0.15)",  color: "#fde047",  label: "Pending" },
    settled:        { bg: "rgba(134,239,172,0.15)", color: "#86efac",  label: "Settled" },
  };
  const s = m[status] ?? { bg: "rgba(255,255,255,0.08)", color: DK.textPrimary, label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px",
      borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
  );
};

const THead: React.FC<{ cols: string[] }> = ({ cols }) => (
  <thead>
    <tr style={{ background: DK.theadBg }}>
      {cols.map(h => (
        <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: DK.textMuted,
          textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em",
          fontWeight: 600, borderBottom: DK.divider, whiteSpace: "nowrap" }}>{h}</th>
      ))}
    </tr>
  </thead>
);

const EmptyRow: React.FC<{ cols: number; message?: string }> = ({ cols, message = "No records." }) => (
  <tr><td colSpan={cols} style={{ padding: 28, textAlign: "center", color: DK.textMuted, fontSize: 13 }}>{message}</td></tr>
);

const TD: React.FC<{ children: React.ReactNode; mono?: boolean; muted?: boolean; bold?: boolean; color?: string; nowrap?: boolean; small?: boolean }> = ({
  children, mono, muted, bold, color, nowrap, small,
}) => (
  <td style={{
    padding: "10px 12px",
    fontSize: small ? 12 : 13,
    fontFamily: mono ? "monospace" : undefined,
    fontWeight: bold ? 600 : undefined,
    color: color ?? (muted ? DK.textSubtle : DK.textPrimary),
    whiteSpace: nowrap ? "nowrap" : undefined,
  }}>{children}</td>
);

function SubTabNav<T extends string>({
  tabs, active, onChange,
}: { tabs: [T, string][]; active: T; onChange: (t: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: DK.divider, marginBottom: 16 }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} style={{
          padding: "8px 16px", background: "none", border: "none",
          borderBottom: `2px solid ${active === key ? "#D1AE38" : "transparent"}`,
          marginBottom: -1, fontSize: 13,
          fontWeight: active === key ? 600 : 400,
          color: active === key ? "#D1AE38" : DK.textSubtle,
          cursor: "pointer",
        }}>{label}</button>
      ))}
    </div>
  );
}

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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Total Visits"  value={String(data?.total_visits ?? 0)} />
        <SCard label="Total Spent"   value={fmt(data?.total_spent as number)} color="#D1AE38" />
        <SCard label="Avg Session"   value={fmt(data?.avg_session as number)} />
        <SCard label="Outstanding"   value={fmt(data?.outstanding as number)}
          color={(data?.outstanding as number) > 0 ? "#fca5a5" : "#86efac"} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: DK.textPrimary }}>
        Invoice History ({invoices.length})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
          <THead cols={["Invoice No", "Date", "Amount", "Status", ""]} />
          <tbody>
            {invoices.length === 0
              ? <EmptyRow cols={5} message="No invoices." />
              : invoices.map(inv => (
                <tr key={String(inv.id)} style={{ borderBottom: DK.rowBorder }}>
                  <TD mono bold>{String(inv.invoice_no ?? "—")}</TD>
                  <TD>{formatDate(inv.issued_at as string)}</TD>
                  <TD bold>{fmt(inv.total_amount as number, String(inv.currency ?? "MYR"))}</TD>
                  <td style={{ padding: "10px 12px" }}><IBadge status={String(inv.status ?? "draft")} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <a href={`/invoices/${inv.id}`} style={{ fontSize: 12, color: "#818cf8" }}>View</a>
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <SCard label="Month Sessions" value={String(summary?.month_sessions ?? 0)} />
        <SCard label="Month Gross"    value={fmt(summary?.month_gross as number)} color="#D1AE38" />
        <SCard label="Month Payout"   value={fmt(summary?.month_payout as number)} color="#86efac" />
        <SCard label="Pending"        value={fmt(summary?.pending_payout as number)}
          color={(summary?.pending_payout as number) > 0 ? "#fca5a5" : "#86efac"} />
      </div>

      <SubTabNav
        tabs={[["sessions", "Sessions"], ["payouts", "Payouts"]]}
        active={tab}
        onChange={setTab}
      />

      {tab === "sessions" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
            <THead cols={["Date", "Type", "Hours", "Gross", "Rate", "Payout", "Commission"]} />
            <tbody>
              {sessions.length === 0
                ? <EmptyRow cols={7} />
                : sessions.map(s => (
                  <tr key={String(s.id)} style={{ borderBottom: DK.rowBorder }}>
                    <TD nowrap>{formatDate(s.start_at as string)}</TD>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        background: s.session_type === "outcall" ? "rgba(253,224,71,0.15)" : "rgba(147,197,253,0.15)",
                        color: s.session_type === "outcall" ? "#fde047" : "#93c5fd",
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      }}>{s.session_type === "outcall" ? "Out-Call" : "In-Call"}</span>
                    </td>
                    <TD>{s.hours_worked ? `${parseFloat(String(s.hours_worked)).toFixed(1)}h` : "—"}</TD>
                    <TD bold>{fmt(s.gross_amount as number)}</TD>
                    <TD muted>{String(s.payout_rate ?? "—")}%</TD>
                    <TD bold color="#86efac">{fmt(s.net_payout as number)}</TD>
                    <TD color="#fca5a5">
                      {(s.agent_commission as number) > 0 ? fmt(s.agent_commission as number) : "—"}
                    </TD>
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
            <THead cols={["Period", "Sessions", "Payout", "Status", "Paid At"]} />
            <tbody>
              {payouts.length === 0
                ? <EmptyRow cols={5} />
                : payouts.map(p => (
                  <tr key={String(p.id)} style={{ borderBottom: DK.rowBorder }}>
                    <TD>{formatDate(p.period_from as string)} ~ {formatDate(p.period_to as string)}</TD>
                    <TD>{String(p.total_sessions ?? 0)}</TD>
                    <TD bold color="#86efac">{fmt(p.total_payout as number)}</TD>
                    <td style={{ padding: "10px 12px" }}><IBadge status={String(p.status ?? "pending")} /></td>
                    <TD muted>{formatDate(p.paid_at as string)}</TD>
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

// ── AgentAccountTab (Agency type) ────────────────────────────────────
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Hostesses"     value={String(summary?.hostess_count ?? 0)} />
        <SCard label="Month Comm."   value={fmt(summary?.month_commission as number)} color="#D1AE38" />
        <SCard label="Pending"       value={fmt(summary?.pending_commission as number)}
          color={(summary?.pending_commission as number) > 0 ? "#fca5a5" : "#86efac"} />
        <SCard label="Total Earned"  value={fmt(summary?.total_commission as number)} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
          <THead cols={["Date", "Hostess", "Base Amount", "Rate", "Commission", "Status"]} />
          <tbody>
            {comms.length === 0
              ? <EmptyRow cols={6} />
              : comms.map(c => (
                <tr key={String(c.id)} style={{ borderBottom: DK.rowBorder }}>
                  <TD nowrap>{formatDate(c.created_at as string)}</TD>
                  <TD>{String(c.hostess_name ?? c.hostess_id ?? "—")}</TD>
                  <TD>{fmt(c.base_amount as number)}</TD>
                  <TD>
                    {c.commission_type === "percentage"
                      ? `${c.rate}%`
                      : fmt(c.rate as number)}
                  </TD>
                  <TD bold color="#86efac">{fmt(c.commission_amount as number)}</TD>
                  <td style={{ padding: "10px 12px" }}><IBadge status={String(c.status ?? "pending")} /></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── IndividualAgentAccountTab ────────────────────────────────────────
interface IndividualAgentAccountTabProps { agentId: string; creditBalance?: number }
export const IndividualAgentAccountTab: React.FC<IndividualAgentAccountTabProps> = ({ agentId, creditBalance }) => {
  const [comms,   setComms]   = useState<Record<string, unknown>[]>([]);
  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"commissions" | "payouts">("commissions");

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${agentId}/commissions`).then(r => r.json()),
      fetch(`/api/agents/${agentId}/payouts`).then(r => r.json()),
    ]).then(([cJson, pJson]) => {
      setComms(cJson.data ?? []);
      setPayouts(pJson.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  const totalEarned  = comms.reduce((s, c) => s + parseFloat(String(c.commissionAmount ?? 0)), 0);
  const totalPending = comms.filter(c => c.status === "pending").reduce((s, c) => s + parseFloat(String(c.commissionAmount ?? 0)), 0);
  const totalSettled = comms.filter(c => c.status === "settled").reduce((s, c) => s + parseFloat(String(c.commissionAmount ?? 0)), 0);
  const balance      = creditBalance ?? 0;

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Referrals"        value={String(comms.length)} />
        <SCard label="Total Earned"     value={fmt(totalEarned)}  color="#D1AE38" />
        <SCard label="Settled"          value={fmt(totalSettled)} color="#86efac" />
        <SCard label="Pending"          value={fmt(totalPending)}
          color={totalPending > 0 ? "#fca5a5" : "#86efac"} />
        <SCard label="Bal. Outstanding" value={fmt(balance)}
          color={balance > 0 ? "#D1AE38" : DK.textMuted} />
      </div>

      <SubTabNav
        tabs={[["commissions", "Commission Records"], ["payouts", "Payout History"]]}
        active={activeSection}
        onChange={setActiveSection}
      />

      {/* Commission Records */}
      {activeSection === "commissions" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
            <THead cols={["Date", "Reservation", "Customer", "Base Amount", "Rate", "Commission", "Status"]} />
            <tbody>
              {comms.length === 0
                ? <EmptyRow cols={7} message="No commission records yet." />
                : comms.map(c => (
                  <tr key={String(c.id)} style={{ borderBottom: DK.rowBorder }}>
                    <TD nowrap>{formatDate(c.reservationDate as string ?? c.createdAt as string)}</TD>
                    <TD mono>{String(c.reservationNo ?? "—")}</TD>
                    <TD>{String(c.customerName ?? "—")}</TD>
                    <TD>{fmt(c.baseAmount as number)}</TD>
                    <TD>
                      {c.commissionType === "percentage" || c.commissionType === "pct"
                        ? `${c.rate}%`
                        : fmt(c.rate as number)}
                    </TD>
                    <TD bold color="#86efac">{fmt(c.commissionAmount as number)}</TD>
                    <td style={{ padding: "10px 12px" }}><IBadge status={String(c.status ?? "pending")} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Payout History */}
      {activeSection === "payouts" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
            <THead cols={["Paid Date", "Period", "Amount (MYR)", "Method", "Reference", "Processed By"]} />
            <tbody>
              {payouts.length === 0
                ? <EmptyRow cols={6} message="No payout records yet." />
                : payouts.map((p: Record<string, unknown>) => (
                  <tr key={String(p.id)} style={{ borderBottom: DK.rowBorder }}>
                    <TD nowrap>{formatDate(p.paidAt as string)}</TD>
                    <TD small muted>{formatDate(p.periodFrom as string)} – {formatDate(p.periodTo as string)}</TD>
                    <TD bold color="#86efac">{fmt(p.amountMyr as number)}</TD>
                    <TD>{String(p.paymentMethod ?? "—").replace(/_/g, " ")}</TD>
                    <TD mono small>{String(p.paymentRef ?? "—")}</TD>
                    <TD>{String(p.paidByName ?? "—")}</TD>
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  const attendance = (data?.attendance ?? {}) as Record<string, unknown>;
  const sessions   = (data?.sessions   ?? {}) as Record<string, unknown>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: DK.textPrimary, marginBottom: 12 }}>
        Attendance — {currentMonth}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Present"    value={`${attendance.present_days ?? 0}d`} />
        <SCard label="Hours"      value={`${attendance.total_hours ?? 0}h`} color="#D1AE38" />
        <SCard label="Late"       value={`${attendance.late_days ?? 0}d`}
          color={(attendance.late_days as number) > 0 ? "#fca5a5" : DK.textPrimary} />
        <SCard label="Absent"     value={`${attendance.absent_days ?? 0}d`}
          color={(attendance.absent_days as number) > 0 ? "#fca5a5" : DK.textPrimary} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: DK.textPrimary, marginBottom: 12 }}>
        Sessions
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Sessions"   value={String(sessions.month_sessions ?? 0)} />
        <SCard label="Gross"      value={fmt(sessions.month_gross as number)} color="#D1AE38" />
        <SCard label="Payout"     value={fmt(sessions.month_payout as number)} color="#86efac" />
        <SCard label="Pending"    value={fmt(data?.pending_payout as number)}
          color={(data?.pending_payout as number) > 0 ? "#fca5a5" : "#86efac"} />
      </div>
      <div style={{ color: DK.textMuted, fontSize: 13, textAlign: "center", padding: 8 }}>
        Detailed payment records are available in the Payments menu.
      </div>
    </div>
  );
};

// ── RoomAccountTab ──────────────────────────────────────────────────
interface RoomAccountTabProps { roomId: string }
export const RoomAccountTab: React.FC<RoomAccountTabProps> = ({ roomId }) => {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/room/${roomId}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [roomId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: DK.textMuted }}>Loading...</div>;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <SCard label="Total Sessions" value={String(data?.total_sessions ?? 0)} />
        <SCard label="Total Revenue"  value={fmt(data?.total_revenue as number)} color="#D1AE38" />
        <SCard label="Avg Duration"   value={`${data?.avg_duration ?? 0}h`} />
        <SCard label="Occupancy"      value={`${data?.occupancy_rate ?? 0}%`} color="#86efac" />
      </div>
      <div style={{ color: DK.textMuted, fontSize: 13, textAlign: "center", padding: 8 }}>
        Detailed session records are available in the Reservations menu.
      </div>
    </div>
  );
};
