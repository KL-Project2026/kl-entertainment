import { useTranslation } from "react-i18next";
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

async function fetchJson(url: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function GeneralDashboard() {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuthStore();
  const fmtTime = (iso: string | null): string => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  };
  const fmtDate = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });

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
            <h1 className="text-xl font-bold font-display">{staffInfo.name ?? user?.name ?? t("dashboards.general.default_name")}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {t(`staff.role.${staffInfo.role ?? user?.role ?? "general"}`, { defaultValue: staffInfo.role ?? user?.role ?? t("dashboards.general.default_role") })} · {staffInfo.employee_code ?? ""}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label={t("dashboards.general.kpi.attendance_rate")} value={`${attRate}%`} sub={t("dashboards.general.kpi.days_present", { n: att.present_days ?? 0 })} icon={CalendarCheck} color={ROLE_COLOR} />
          <KpiCard label={t("dashboards.general.kpi.hours_this_month")} value={t("dashboards.common.hours_short", { n: totalHours.toFixed(1) })} sub={t("dashboards.general.kpi.late_days", { n: att.late_days ?? 0 })} icon={Clock} color="#60a5fa" />
          <KpiCard label={t("dashboards.general.kpi.penalty_deduction")} value={formatCurrency(parseFloat(payroll.penalty_deduction ?? "0"))} icon={TrendingUp} color="#ef4444" />
          <KpiCard label={t("dashboards.general.kpi.est_net_pay")} value={formatCurrency(parseFloat(payroll.estimated_net ?? "0"))} sub={t("dashboards.general.kpi.base_minus_penalties")} icon={DollarSign} color="#4ade80" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timesheet */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-display text-lg font-semibold mb-4">{t("dashboards.general.attendance_14")}</h3>
            {timeLoading ? (
              <div className="space-y-2 animate-pulse">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-muted/40 rounded" />)}</div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboards.common.no_records")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-white/5">
                      <th className="text-left pb-2 font-medium">{t("dashboards.general.table.date")}</th>
                      <th className="text-right pb-2 font-medium">{t("dashboards.general.table.clock_in")}</th>
                      <th className="text-right pb-2 font-medium">{t("dashboards.general.table.clock_out")}</th>
                      <th className="text-right pb-2 font-medium">{t("dashboards.general.table.hours")}</th>
                      <th className="text-left pb-2 font-medium pl-4">{t("dashboards.general.table.status")}</th>
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
                            {row.hours_worked ? t("dashboards.common.hours_short", { n: parseFloat(row.hours_worked).toFixed(1) }) : "—"}
                          </td>
                          <td className="py-2 pl-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ss.bg} ${ss.text} capitalize`}>
                              {t(`dashboards.common.attendance.${row.status}`, { defaultValue: row.status.replace("_", " ") })}
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
            <h3 className="font-display text-lg font-semibold mb-4">{t("dashboards.general.pay_estimate")}</h3>
            {payLoading ? (
              <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted/40 rounded" />)}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">{t("dashboards.general.base_salary")}</span>
                  <span className="font-mono font-semibold">{formatCurrency(parseFloat(payroll.base_salary ?? "0"))}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">{t("dashboards.general.penalty_deductions")}</span>
                  <span className="font-mono font-semibold text-red-400">-{formatCurrency(parseFloat(payroll.penalty_deduction ?? "0"))}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-t-2 border-white/10 mt-2">
                  <span className="font-semibold">{t("dashboards.general.est_net_pay_label")}</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">{formatCurrency(parseFloat(payroll.estimated_net ?? "0"))}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  {t("dashboards.general.currency_note", { ccy: payroll.currency ?? "MYR" })}
                </p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/5">
              <h4 className="text-sm font-semibold mb-3">{t("dashboards.general.this_month")}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dashboards.general.present")}</span>
                  <span className="font-semibold text-emerald-400">{t("dashboards.general.days_short", { n: att.present_days ?? 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dashboards.general.late")}</span>
                  <span className="font-semibold text-amber-400">{t("dashboards.general.days_short", { n: att.late_days ?? 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dashboards.general.absent")}</span>
                  <span className="font-semibold text-red-400">{t("dashboards.general.days_short", { n: att.absent_days ?? 0 })}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
