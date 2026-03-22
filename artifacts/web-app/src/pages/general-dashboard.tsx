import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Clock, CalendarCheck, TrendingUp, DollarSign } from "lucide-react";

const ROLE_COLOR = "#9a9baa"; // Gray

type TimesheetRow = {
  id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  late_minutes: number;
  early_leave_min: number;
  penalty_amount: string;
  shift_start: string | null;
  shift_end: string | null;
  hours_worked: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  present:    { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  late:       { bg: "bg-amber-500/10",   text: "text-amber-400" },
  absent:     { bg: "bg-red-500/10",     text: "text-red-400" },
  day_off:    { bg: "bg-blue-500/10",    text: "text-blue-400" },
  sick:       { bg: "bg-purple-500/10",  text: "text-purple-400" },
  no_show:    { bg: "bg-red-500/10",     text: "text-red-400" },
  early_leave:{ bg: "bg-amber-500/10",   text: "text-amber-400" },
};

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card className="p-6 flex items-start gap-4">
      <div className="p-3 rounded-xl" style={{ backgroundColor: color + "22" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-[26px] font-bold leading-none font-mono" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", { weekday: "short", month: "short", day: "numeric" });
}

async function fetchJson(url: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function GeneralDashboard() {
  const { user, token } = useAuthStore();

  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ["dash:general:timesheet", user?.id],
    queryFn: () => fetchJson("/api/dashboards/general/timesheet", token),
    refetchInterval: 60_000,
  });

  const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ["dash:general:pay", user?.id],
    queryFn: () => fetchJson("/api/dashboards/general/pay-estimate", token),
    refetchInterval: 300_000,
  });

  const rows: TimesheetRow[] = timeData?.data ?? [];
  const pay = payData?.data ?? {};
  const staffInfo = pay.staff ?? {};
  const payroll = pay.payroll ?? {};
  const att = pay.attendance ?? {};

  const totalHours = parseFloat(att.total_hours ?? "0");
  const attRate = att.present_days && (att.present_days + att.late_days + att.absent_days) > 0
    ? Math.round((att.present_days / (att.present_days + att.late_days + att.absent_days)) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header / Profile */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: ROLE_COLOR + "22", color: ROLE_COLOR }}>
            {(staffInfo.name ?? user?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">{staffInfo.name ?? user?.name ?? "Staff"}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {staffInfo.role ?? user?.role ?? "General"} · {staffInfo.employee_code ?? ""}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Attendance Rate" value={`${attRate}%`} sub={`${att.present_days ?? 0} days present`} icon={CalendarCheck} color={ROLE_COLOR} />
          <KpiCard label="Hours This Month" value={`${totalHours.toFixed(1)}h`} sub={`${att.late_days ?? 0} late days`} icon={Clock} color="#60a5fa" />
          <KpiCard label="Penalty Deduction" value={formatCurrency(parseFloat(payroll.penalty_deduction ?? "0"))} icon={TrendingUp} color="#ef4444" />
          <KpiCard label="Est. Net Pay" value={formatCurrency(parseFloat(payroll.estimated_net ?? "0"))} sub="Base minus penalties" icon={DollarSign} color="#4ade80" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timesheet */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Attendance (Last 14 Days)</h3>
            {timeLoading ? (
              <div className="space-y-2 animate-pulse">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-muted/40 rounded" />)}</div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-white/5">
                      <th className="text-left pb-2 font-medium">Date</th>
                      <th className="text-right pb-2 font-medium">Clock In</th>
                      <th className="text-right pb-2 font-medium">Clock Out</th>
                      <th className="text-right pb-2 font-medium">Hours</th>
                      <th className="text-left pb-2 font-medium pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map(row => {
                      const ss = STATUS_STYLES[row.status] ?? STATUS_STYLES.present;
                      return (
                        <tr key={row.id}>
                          <td className="py-2 font-medium">{fmtDate(row.work_date)}</td>
                          <td className="py-2 text-right font-mono text-xs">{fmtTime(row.clock_in)}</td>
                          <td className="py-2 text-right font-mono text-xs">{fmtTime(row.clock_out)}</td>
                          <td className="py-2 text-right font-mono text-xs">
                            {row.hours_worked ? `${parseFloat(row.hours_worked).toFixed(1)}h` : "—"}
                          </td>
                          <td className="py-2 pl-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ss.bg} ${ss.text} capitalize`}>
                              {row.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pay Estimate */}
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Pay Estimate</h3>
            {payLoading ? (
              <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted/40 rounded" />)}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Base Salary</span>
                  <span className="font-mono font-semibold">{formatCurrency(parseFloat(payroll.base_salary ?? "0"))}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Penalty Deductions</span>
                  <span className="font-mono font-semibold text-red-400">-{formatCurrency(parseFloat(payroll.penalty_deduction ?? "0"))}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-t-2 border-white/10 mt-2">
                  <span className="font-semibold">Est. Net Pay</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">{formatCurrency(parseFloat(payroll.estimated_net ?? "0"))}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Currency: {payroll.currency ?? "MYR"} · Estimate only, subject to final approval.
                </p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/5">
              <h4 className="text-sm font-semibold mb-3">This Month</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Present</span>
                  <span className="font-semibold text-emerald-400">{att.present_days ?? 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late</span>
                  <span className="font-semibold text-amber-400">{att.late_days ?? 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Absent</span>
                  <span className="font-semibold text-red-400">{att.absent_days ?? 0} days</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
