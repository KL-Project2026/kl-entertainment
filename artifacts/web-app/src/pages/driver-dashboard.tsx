import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin, CheckCircle, Clock } from "lucide-react";

const ROLE_COLOR = "#fb923c"; // Orange

type JobRow = {
  id: string;
  pickup_time: string | null;
  return_time: string | null;
  status: string;
  notes: string | null;
  pickup_address: string | null;
  return_address: string | null;
  driver_name: string | null;
  branch_name: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:      { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Scheduled" },
  en_route:       { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "En Route" },
  arrived:        { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Arrived" },
  completed:      { bg: "bg-gray-500/10",    text: "text-gray-400",    label: "Completed" },
  issue_reported: { bg: "bg-red-500/10",     text: "text-red-400",     label: "Issue" },
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

async function fetchJson(url: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function DriverDashboard() {
  const { user, token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["dash:driver:jobs", user?.id],
    queryFn: () => fetchJson("/api/dashboards/driver/jobs", token),
    refetchInterval: 30_000,
  });

  const jobs: JobRow[] = data?.data ?? [];
  const summary = data?.summary ?? { trips_today: 0, pending: 0, active: 0, completed: 0 };
  const nextJob = jobs.find(j => j.status === "scheduled");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ROLE_COLOR }} />
          <div>
            <h1 className="text-xl font-bold font-display">Driver Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your pickup & delivery schedule</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Trips Today" value={String(summary.trips_today)} icon={Car} color={ROLE_COLOR} />
          <KpiCard label="Pending" value={String(summary.pending)} sub="Scheduled jobs" icon={Clock} color="#f5c842" />
          <KpiCard label="Active" value={String(summary.active)} sub="En route / Arrived" icon={MapPin} color="#2dd4bf" />
          <KpiCard label="Completed" value={String(summary.completed)} sub="Today" icon={CheckCircle} color="#4ade80" />
        </div>

        {/* Next Job highlight */}
        {nextJob && (
          <Card className="p-5 border-l-4" style={{ borderLeftColor: ROLE_COLOR }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Next Job</p>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold">{fmtTime(nextJob.pickup_time)} — Pickup</p>
                <p className="text-sm text-muted-foreground mt-0.5">{nextJob.pickup_address ?? "Address not specified"}</p>
              </div>
              {nextJob.return_address && (
                <div className="flex-1">
                  <p className="font-semibold text-sm text-muted-foreground">Return to</p>
                  <p className="text-sm">{nextJob.return_address}</p>
                </div>
              )}
              <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Scheduled
              </span>
            </div>
          </Card>
        )}

        {/* Job Queue */}
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Job Queue</h3>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 rounded-lg" />)}</div>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs assigned.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const ss = STATUS_STYLES[job.status] ?? { bg: "bg-white/5", text: "text-muted-foreground", label: job.status };
                return (
                  <div key={job.id} className="rounded-lg bg-white/3 border border-white/5 p-4 flex gap-4 items-start">
                    <div className="shrink-0 text-center min-w-[56px]">
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="font-mono text-sm font-semibold" style={{ color: ROLE_COLOR }}>{fmtTime(job.pickup_time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{job.pickup_address ?? "—"}</span>
                      </div>
                      {job.return_address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs truncate">→ {job.return_address}</span>
                        </div>
                      )}
                      {job.notes && <p className="text-xs text-muted-foreground mt-1 italic">{job.notes}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>{ss.label}</span>
                      <span className="text-xs text-muted-foreground">{job.branch_name ?? ""}</span>
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
