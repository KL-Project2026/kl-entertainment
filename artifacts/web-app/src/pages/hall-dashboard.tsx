import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListTodo, CheckCircle2, AlertCircle, BedDouble, Loader2, Check } from "lucide-react";
import { useState } from "react";

const ROLE_COLOR = "#a78bfa"; // Purple

type TaskRow = {
  id: string;
  description: string;
  quantity: number;
  item_type: string;
  created_at: string;
  order_id: string;
  room_name: string | null;
  reservation_no: string | null;
  priority: string;
};

const PRIORITY_STYLES = {
  high:   { bg: "bg-red-500/10",   border: "border-red-500/30",   text: "text-red-400",   dot: "bg-red-400" },
  normal: { bg: "bg-blue-500/10",  border: "border-blue-500/30",  text: "text-blue-400",  dot: "bg-blue-400" },
  low:    { bg: "bg-gray-500/10",  border: "border-gray-500/30",  text: "text-gray-400",  dot: "bg-gray-400" },
};

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

export default function HallDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const branchId = user?.branchId;
  const qs = branchId ? `?branch_id=${branchId}` : "";
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dash:hall:tasks", branchId],
    queryFn: () => fetchJson(`/api/dashboards/hall/tasks${qs}`),
    refetchInterval: 20_000,
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/dashboards/hall/tasks/${id}/done`, { method: "PATCH" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (_, id) => {
      setDoneSet(prev => new Set([...prev, id]));
      setLoadingId(null);
      qc.invalidateQueries({ queryKey: ["dash:hall:tasks"] });
    },
    onError: () => setLoadingId(null),
  });

  const allTasks: TaskRow[] = data?.data ?? [];
  const tasks = allTasks.filter(t => !doneSet.has(t.id));
  const summary = data?.summary ?? {};
  const completedToday = doneSet.size;
  const high = tasks.filter(t => t.priority === "high").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ROLE_COLOR }} />
          <div>
            <h1 className="text-xl font-bold font-display">Hall Staff Dashboard</h1>
            <p className="text-sm text-muted-foreground">Service task queue for your zone</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Open Tasks" value={tasks.length} icon={ListTodo} color={ROLE_COLOR} />
          <KpiCard label="High Priority" value={high} icon={AlertCircle} color="#ef4444" />
          <KpiCard label="Completed Today" value={completedToday} icon={CheckCircle2} color="#4ade80" />
          <KpiCard label="Total Orders" value={summary.open ?? allTasks.length} icon={BedDouble} color="#f5c842" />
        </div>

        {/* Task Queue */}
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Task Queue</h3>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl" />)}</div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <p className="font-semibold text-emerald-400">All clear!</p>
              <p className="text-sm text-muted-foreground mt-1">No open tasks. Great work.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const ps = PRIORITY_STYLES[task.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.normal;
                const done = doneSet.has(task.id);
                return (
                  <div key={task.id}
                    className={`rounded-xl border p-4 flex gap-4 items-center transition-opacity ${done ? "opacity-40" : ""} ${ps.bg} ${ps.border}`}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ps.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{task.description}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{task.room_name ?? "Unknown Room"}</span>
                        {task.reservation_no && <span className="font-mono">{task.reservation_no}</span>}
                        <span>×{Number(task.quantity)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ps.bg} ${ps.text} border ${ps.border} capitalize`}>
                        {task.priority}
                      </span>
                      <button
                        onClick={() => { setLoadingId(task.id); markDone.mutate(task.id); }}
                        disabled={done || loadingId === task.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: "#a78bfa22", color: ROLE_COLOR }}>
                        {loadingId === task.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Check className="w-3 h-3" />}
                        Done
                      </button>
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
