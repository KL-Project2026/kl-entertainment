import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { ClipboardList, Users, Receipt, Clock } from "lucide-react";

const ROLE_COLOR = "#60a5fa"; // Blue

type OrderRow = { id: string; room_name: string | null; reservation_no: string | null; payment_status: string; order_total: string; item_count: string; created_at: string };
type HostessRow = { id: string; full_name: string; room_name: string | null; start_at: string | null; rate_per_hour: string | null; net_payout: string | null; reservation_no: string | null };

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

function elapsed(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function fetchJson(url: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function ManagerDashboard() {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const branchId = user?.branchId;
  const qs = branchId ? `?branch_id=${branchId}` : "";

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["dash:mgr:orders", branchId],
    queryFn: () => fetchJson(`/api/dashboards/manager/orders${qs}`, token),
    refetchInterval: 30_000,
  });

  const { data: hostData, isLoading: hostLoading } = useQuery({
    queryKey: ["dash:mgr:hostesses", branchId],
    queryFn: () => fetchJson(`/api/dashboards/manager/hostesses${qs}`, token),
    refetchInterval: 30_000,
  });

  const orders: OrderRow[] = ordersData?.data ?? [];
  const openFolios: number = ordersData?.summary?.open_folios ?? 0;
  const hostesses: HostessRow[] = hostData?.data ?? [];
  const activeHostesses = hostesses.filter(h => h.start_at);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ROLE_COLOR }} />
          <div>
            <h1 className="text-xl font-bold font-display">{t("dashboards.manager.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("dashboards.manager.subtitle")}</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label={t("dashboards.manager.kpi.open_folios")} value={String(openFolios)} icon={Receipt} color={ROLE_COLOR} />
          <KpiCard label={t("dashboards.manager.kpi.pending_orders")} value={String(orders.length)} sub={t("dashboards.manager.kpi.unpaid_or_partial")} icon={ClipboardList} color="#fb923c" />
          <KpiCard label={t("dashboards.manager.kpi.active_hostesses")} value={String(activeHostesses.length)} sub={t("dashboards.manager.kpi.of_n_on_duty", { n: hostesses.length })} icon={Users} color="#e8407a" />
          <KpiCard label={t("dashboards.manager.kpi.in_session")} value={activeHostesses.length > 0 ? elapsed(activeHostesses[0]?.start_at ?? null) : "—"} sub={t("dashboards.manager.kpi.oldest_session")} icon={Clock} color="#a78bfa" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* F&B Order Table */}
          <Card className="lg:col-span-3 p-6">
            <h3 className="font-display text-lg font-semibold mb-4">{t("dashboards.manager.open_orders")}</h3>
            {ordersLoading ? (
              <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted/40 rounded" />)}</div>
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboards.common.no_pending_orders")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-white/5">
                      <th className="text-left pb-2 font-medium">{t("dashboards.manager.table.room")}</th>
                      <th className="text-left pb-2 font-medium">{t("dashboards.manager.table.reservation_no")}</th>
                      <th className="text-right pb-2 font-medium">{t("dashboards.manager.table.items")}</th>
                      <th className="text-right pb-2 font-medium">{t("dashboards.manager.table.total")}</th>
                      <th className="text-left pb-2 font-medium pl-4">{t("dashboards.manager.table.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.slice(0, 20).map(o => (
                      <tr key={o.id} className="hover:bg-white/2">
                        <td className="py-2 font-medium">{o.room_name ?? "—"}</td>
                        <td className="py-2 text-muted-foreground font-mono text-xs">{o.reservation_no ?? "—"}</td>
                        <td className="py-2 text-right text-muted-foreground">{o.item_count}</td>
                        <td className="py-2 text-right font-mono font-semibold">{formatCurrency(parseFloat(o.order_total))}</td>
                        <td className="py-2 pl-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            o.payment_status === "pending" ? "bg-amber-500/15 text-amber-400" :
                            "bg-blue-500/15 text-blue-400"
                          }`}>{t(`dashboards.common.order_status.${o.payment_status}`, { defaultValue: o.payment_status })}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Hostess Board */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-display text-lg font-semibold mb-4" style={{ color: "#e8407a" }}>{t("dashboards.manager.hostess_board")}</h3>
            {hostLoading ? (
              <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-lg" />)}</div>
            ) : hostesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboards.common.no_hostesses_scheduled")}</p>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {hostesses.map(h => (
                  <div key={h.id} className="rounded-lg bg-white/3 border border-white/5 p-3 flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: "#e8407a22", color: "#e8407a" }}>
                      {h.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{h.full_name}</p>
                      <p className="text-xs text-muted-foreground">{h.room_name ?? t("dashboards.common.not_assigned")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {h.start_at ? (
                        <>
                          <p className="text-xs font-mono text-emerald-400">{elapsed(h.start_at)}</p>
                          <p className="text-xs text-muted-foreground">{t("dashboards.manager.rate_per_hour", { rate: parseFloat(h.rate_per_hour ?? "0").toFixed(0) })}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("dashboards.common.standby")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
