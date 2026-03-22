import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Users, BedDouble, TrendingUp, CalendarCheck, Wifi, WifiOff } from "lucide-react";

const ROLE_COLOR = "#2dd4bf"; // Teal

type RoomRow = { id: string; name: string; room_type: string; status: string; floor_level: string | null; capacity_min: number | null; capacity_max: number | null };
type StaffRow = { full_name: string; role: string; employee_code: string; clock_in: string | null; attendance_status: string; late_minutes: number };

const STATUS_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  available:   { border: "border-emerald-500", bg: "bg-emerald-500/10", label: "Available" },
  occupied:    { border: "border-red-500",     bg: "bg-red-500/10",     label: "Occupied" },
  cleaning:    { border: "border-amber-500",   bg: "bg-amber-500/10",   label: "Cleaning" },
  maintenance: { border: "border-gray-500",    bg: "bg-gray-500/10",    label: "Maintenance" },
  blocked:     { border: "border-gray-700",    bg: "bg-gray-700/10",    label: "Blocked" },
};

function RoomChip({ room }: { room: RoomRow }) {
  const s = STATUS_STYLES[room.status] ?? STATUS_STYLES.blocked;
  return (
    <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-3 flex flex-col gap-1`}>
      <span className="font-semibold text-sm text-foreground truncate">{room.name}</span>
      <span className={`text-xs font-medium`} style={{ color: ROLE_COLOR }}>{s.label}</span>
      <span className="text-xs text-muted-foreground capitalize">{room.room_type.replace("_", " ")}</span>
    </div>
  );
}

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

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export default function BranchManagerDashboard() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;
  const qs = branchId ? `?branch_id=${branchId}` : "";

  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ["dash:bm:live", branchId],
    queryFn: () => fetchJson(`/api/dashboards/branch-manager/live${qs}`),
    refetchInterval: 30_000,
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["dash:bm:staff", branchId],
    queryFn: () => fetchJson(`/api/dashboards/branch-manager/staff${qs}`),
    refetchInterval: 60_000,
  });

  const live = liveData?.data ?? {};
  const rooms: RoomRow[] = live.rooms ?? [];
  const roomSummary = live.room_summary ?? { available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
  const staff: StaffRow[] = staffData?.data ?? [];
  const resvToday: { status: string; count: string }[] = live.reservations_today ?? [];
  const totalRes = resvToday.reduce((a, r) => a + parseInt(r.count, 10), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: ROLE_COLOR }} />
          <div>
            <h1 className="text-xl font-bold font-display">Branch Manager Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {user?.branchId ? "Live branch operations" : "All branches"}
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3 h-3" /> LIVE
              </span>
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        {liveLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-card rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard label="Today's Revenue" value={formatCurrency(live.revenue_today ?? 0)} icon={TrendingUp} color={ROLE_COLOR} />
            <KpiCard label="Occupied Rooms" value={`${roomSummary.occupied} / ${rooms.length}`} sub={`${Math.round((roomSummary.occupied / (rooms.length || 1)) * 100)}% occupancy`} icon={BedDouble} color="#f5c842" />
            <KpiCard label="Staff On Duty" value={String(live.staff_on_duty ?? 0)} sub="Clocked in" icon={Users} color="#60a5fa" />
            <KpiCard label="Sessions Today" value={String(totalRes)} sub="All reservation statuses" icon={CalendarCheck} color="#4ade80" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Room Board */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              Live Room Board
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> LIVE
              </span>
            </h3>
            {liveLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rooms.map(r => <RoomChip key={r.id} room={r} />)}
              </div>
            )}
            {/* Status legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
              {Object.entries(STATUS_STYLES).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${v.border}`} />
                  {v.label}: {(roomSummary as Record<string, number>)[k] ?? 0}
                </div>
              ))}
            </div>
          </Card>

          {/* Staff On Duty */}
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Staff On Duty</h3>
            {staffLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-muted/40 rounded-lg" />)}
              </div>
            ) : staff.length === 0 ? (
              <p className="text-muted-foreground text-sm">No attendance records today.</p>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                {staff.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: ROLE_COLOR + "22", color: ROLE_COLOR }}>
                      {s.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.role.replace("_", " ")}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.clock_in && !s.clock_out ? "bg-emerald-500/15 text-emerald-400" :
                      s.attendance_status === "late" ? "bg-amber-500/15 text-amber-400" :
                      "bg-white/5 text-muted-foreground"
                    }`}>
                      {s.clock_in && !s.clock_out ? "On duty" : s.attendance_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Reservation Status Breakdown */}
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Today's Reservations</h3>
          <div className="flex flex-wrap gap-3">
            {resvToday.map(r => (
              <div key={r.status} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-lg font-bold font-mono">{r.count}</p>
                <p className="text-xs text-muted-foreground capitalize">{r.status.replace("_", " ")}</p>
              </div>
            ))}
            {resvToday.length === 0 && <p className="text-muted-foreground text-sm">No reservations today.</p>}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
