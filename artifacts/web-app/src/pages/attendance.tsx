import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, LogIn, LogOut, AlertTriangle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  late: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  absent: "bg-red-500/20 text-red-300 border-red-500/30",
  leave: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  half_day: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

interface AttendanceRecord {
  id: string;
  staffId: string;
  workDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  lateMinutes: number;
  penaltyAmount: number;
}

interface StaffMember {
  id: string;
  fullName: string;
  role: string;
  branchId: string;
  employeeCode: string | null;
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function Attendance() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [branchFilter, setBranchFilter] = useState(user?.branchId ?? "__all__");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>;

  const { data: staffData } = useQuery({
    queryKey: ["staff", branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ active: "true" });
      if (branchFilter !== "__all__") params.set("branch_id", branchFilter);
      const r = await fetch(`/api/staff?${params}`, { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const allStaff: StaffMember[] = staffData?.data ?? [];

  // Attendance records for all visible staff over the date range
  const { data: attendanceMap, refetch, isFetching } = useQuery({
    queryKey: ["attendance-bulk", branchFilter, dateFrom, dateTo],
    queryFn: async () => {
      const results = new Map<string, AttendanceRecord[]>();
      await Promise.all(
        allStaff.map(async (s) => {
          const r = await fetch(`/api/staff/${s.id}/attendance?from=${dateFrom}&to=${dateTo}`, {
            headers: getAuthHeader(token),
          });
          const d = await r.json();
          results.set(s.id, d.data ?? []);
        })
      );
      return results;
    },
    enabled: allStaff.length > 0,
  });

  const clockIn = useMutation({
    mutationFn: async (s: StaffMember) => {
      const r = await fetch(`/api/staff/${s.id}/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({ branchId: s.branchId }),
      });
      return r.json();
    },
    onSuccess: () => refetch(),
  });

  const clockOut = useMutation({
    mutationFn: async (staffId: string) => {
      const r = await fetch(`/api/staff/${staffId}/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
      });
      return r.json();
    },
    onSuccess: () => refetch(),
  });

  // Summary stats
  const todayRecords = allStaff.flatMap((s) =>
    (attendanceMap?.get(s.id) ?? []).filter((a) => a.workDate === today)
  );
  const presentCount = todayRecords.filter((r) => r.clockIn).length;
  const lateCount = todayRecords.filter((r) => r.status === "late").length;
  const totalPenalty = todayRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);

  const isToday = dateFrom === today && dateTo === today;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Clock-in/out and lateness tracking</p>
        </div>

        {/* Today summary */}
        {isToday && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Clocked In Today</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{lateCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Late Arrivals</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">RM {totalPenalty.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Penalties Today</p>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} wrapperClassName="w-40" />
            <span className="text-muted-foreground text-sm">to</span>
            <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} wrapperClassName="w-40" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10" style={{ position: "relative" }}>
          {isFetching && (
            <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Penalty</th>
                {isToday && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {allStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    No staff found. Select a branch to view attendance.
                  </td>
                </tr>
              ) : (
                allStaff.map((s) => {
                  const records = attendanceMap?.get(s.id) ?? [];
                  const todayRec = records.find((r) => r.workDate === today);

                  if (isToday) {
                    // Show today's row for each staff member
                    return (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(today)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {todayRec?.scheduledStart
                            ? `${formatTime(todayRec.scheduledStart)} → ${formatTime(todayRec.scheduledEnd)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatTime(todayRec?.clockIn ?? null)}</td>
                        <td className="px-4 py-3 text-sm">{formatTime(todayRec?.clockOut ?? null)}</td>
                        <td className="px-4 py-3">
                          {todayRec ? (
                            <Badge className={`text-xs border ${STATUS_COLORS[todayRec.status] ?? STATUS_COLORS.present}`}>
                              {todayRec.status}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">Not in</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {todayRec?.lateMinutes
                            ? <span className="text-orange-400">{todayRec.lateMinutes}m</span>
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {todayRec?.penaltyAmount
                            ? <span className="text-red-400">RM {Number(todayRec.penaltyAmount).toFixed(2)}</span>
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {!todayRec?.clockIn && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2 gap-1 text-emerald-400 border-emerald-500/30"
                                onClick={() => clockIn.mutate(s)}
                                disabled={clockIn.isPending}
                              >
                                <LogIn className="w-3 h-3" /> In
                              </Button>
                            )}
                            {todayRec?.clockIn && !todayRec.clockOut && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2 gap-1 text-orange-400 border-orange-500/30"
                                onClick={() => clockOut.mutate(s.id)}
                                disabled={clockOut.isPending}
                              >
                                <LogOut className="w-3 h-3" /> Out
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Historical view — show all records
                  return records.map((rec) => (
                    <tr key={rec.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(rec.workDate)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {rec.scheduledStart
                          ? `${formatTime(rec.scheduledStart)} → ${formatTime(rec.scheduledEnd)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatTime(rec.clockIn)}</td>
                      <td className="px-4 py-3 text-sm">{formatTime(rec.clockOut)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${STATUS_COLORS[rec.status] ?? STATUS_COLORS.present}`}>
                          {rec.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {rec.lateMinutes > 0
                          ? <span className="text-orange-400">{rec.lateMinutes}m</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {rec.penaltyAmount > 0
                          ? <span className="text-red-400">RM {Number(rec.penaltyAmount).toFixed(2)}</span>
                          : "—"}
                      </td>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
