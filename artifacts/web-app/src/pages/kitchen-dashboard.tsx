import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Clock, CheckCircle, Loader2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";

const ROLE_COLOR = "#4ade80"; // Green

type OrderItem = { id: string; description: string; quantity: number; item_type: string };
type OrderRow  = {
  id: string;
  room_name: string | null;
  reservation_no: string | null;
  payment_status: string;
  created_at: string;
  items: OrderItem[];
};

// Map payment_status → kitchen concept
function getKitchenStatus(status: string) {
  if (status === "pending") return "pending";
  if (status === "partial")  return "preparing";
  if (status === "paid")     return "ready";
  return "done";
}

const KS_STYLES: Record<string, { bg: string; text: string; label: string; next: string; nextLabel: string }> = {
  pending:  { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Pending",   next: "preparing", nextLabel: "Start Prep" },
  preparing:{ bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Preparing", next: "ready",     nextLabel: "Mark Ready" },
  ready:    { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Ready",     next: "done",      nextLabel: "Complete" },
  done:     { bg: "bg-gray-500/10",    text: "text-gray-400",    label: "Done",      next: "",          nextLabel: "" },
};

function elapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card className="p-6 flex items-start gap-4">
      <div className="p-3 rounded-xl" style={{ backgroundColor: color + "22" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-[26px] font-bold leading-none font-mono" style={{ color }}>{value}</p>
      </div>
    </Card>
  );
}

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function KitchenDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const branchId = user?.branchId;
  const qs = branchId ? `?branch_id=${branchId}` : "";

  const { data, isLoading } = useQuery({
    queryKey: ["dash:kitchen:orders", branchId],
    queryFn: () => fetchJson(`/api/dashboards/kitchen/orders${qs}`),
    refetchInterval: 15_000,
  });

  const orders: OrderRow[] = data?.data ?? [];
  const summary = data?.summary ?? {};
  const [updating, setUpdating] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/dashboards/kitchen/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash:kitchen:orders"] });
      setUpdating(null);
    },
    onError: () => setUpdating(null),
  });

  const pending   = orders.filter(o => getKitchenStatus(o.payment_status) === "pending").length;
  const preparing = orders.filter(o => getKitchenStatus(o.payment_status) === "preparing").length;
  const ready     = orders.filter(o => getKitchenStatus(o.payment_status) === "ready").length;
  const done      = orders.filter(o => getKitchenStatus(o.payment_status) === "done").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ROLE_COLOR }} />
          <div>
            <h1 className="text-xl font-bold font-display">Kitchen Dashboard</h1>
            <p className="text-sm text-muted-foreground">Live order queue — auto-refreshes every 15s</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Pending" value={pending} icon={Clock} color="#f5c842" />
          <KpiCard label="Preparing" value={preparing} icon={ChefHat} color={ROLE_COLOR} />
          <KpiCard label="Ready to Serve" value={ready} icon={UtensilsCrossed} color="#2dd4bf" />
          <KpiCard label="Completed Today" value={done} icon={CheckCircle} color="#9a9baa" />
        </div>

        {/* Active Orders */}
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Active Orders</h3>
          {isLoading ? (
            <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl" />)}</div>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders today.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map(order => {
                const ks = getKitchenStatus(order.payment_status);
                const ss = KS_STYLES[ks] ?? KS_STYLES.pending;
                const ageMs = Date.now() - new Date(order.created_at).getTime();
                const urgent = ageMs > 20 * 60_000 && ks !== "done";
                return (
                  <div key={order.id}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${urgent ? "border-red-500/50 bg-red-500/5" : "border-white/10 bg-white/3"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{order.room_name ?? "Unknown Room"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{order.reservation_no ?? order.id.slice(0, 8)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {urgent && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">URGENT</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>{ss.label}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground/80 truncate max-w-[160px]">{item.description}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">×{Number(item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                      <span className="text-xs text-muted-foreground">{elapsed(order.created_at)}</span>
                      {ss.next && (
                        <button
                          onClick={() => {
                            setUpdating(order.id);
                            updateStatus.mutate({ id: order.id, status: ss.next });
                          }}
                          disabled={updating === order.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1"
                          style={{ backgroundColor: ROLE_COLOR + "22", color: ROLE_COLOR }}>
                          {updating === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {ss.nextLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
