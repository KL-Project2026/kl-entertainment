import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar, Copy, X, Check } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLE_COLORS: Record<string, string> = {
  hostess: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  driver: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  branch_manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Schedule {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isOvernight: boolean;
  effectiveFrom: string;
}

interface StaffMember {
  id: string;
  fullName: string;
  role: string;
}

interface ShiftEditorProps {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  existing?: Schedule;
  effectiveFrom: string;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  token: string | null;
}

function ShiftEditor({
  staffId, staffName, dayOfWeek, existing, effectiveFrom, onSave, onDelete, onClose, token,
}: ShiftEditorProps) {
  const [start, setStart] = useState(existing?.shiftStart?.slice(0, 5) ?? "18:00");
  const [end, setEnd] = useState(existing?.shiftEnd?.slice(0, 5) ?? "02:00");
  const [overnight, setOvernight] = useState(existing?.isOvernight ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
      body: JSON.stringify({
        staffId, dayOfWeek, shiftStart: start, shiftEnd: end,
        isOvernight: overnight, effectiveFrom,
      }),
    });
    setSaving(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!existing?.id) return;
    await fetch(`/api/schedules/${existing.id}`, {
      method: "DELETE",
      headers: getAuthHeader(token),
    });
    onDelete?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="p-5 w-80 space-y-4">
        <div className="flex justify-between">
          <div>
            <p className="font-medium">{staffName}</p>
            <p className="text-xs text-muted-foreground">{DAYS[dayOfWeek]}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Shift Start</label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Shift End</label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
          Overnight shift (ends next day)
        </label>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Shift"}
          </Button>
          {existing && (
            <Button variant="outline" className="text-red-400 border-red-500/30" onClick={handleDelete}>
              Clear
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ScheduleBuilder() {
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const d = new Date();
    const mon = new Date(d.setDate(d.getDate() - d.getDay() + 1));
    return mon.toISOString().split("T")[0];
  });
  const [editing, setEditing] = useState<{ staffId: string; staffName: string; dayOfWeek: number; existing?: Schedule } | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>;

  useEffect(() => {
    if (!branchId && branches.length) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const { data: scheduleData, refetch } = useQuery({
    queryKey: ["schedules", branchId, effectiveFrom],
    queryFn: async () => {
      if (!branchId) return { data: [] };
      const r = await fetch(`/api/schedules?branch_id=${branchId}&effective_date=${effectiveFrom}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const schedules: Schedule[] = scheduleData?.data ?? [];

  // Group schedules by staff
  const staffMap = new Map<string, { name: string; role: string; days: Map<number, Schedule> }>();
  for (const s of schedules) {
    if (!staffMap.has(s.staffId)) {
      staffMap.set(s.staffId, { name: s.staffName, role: s.staffRole, days: new Map() });
    }
    staffMap.get(s.staffId)!.days.set(s.dayOfWeek, s);
  }

  // Also load all staff for the branch (even those without schedules)
  const { data: staffData } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: async () => {
      if (!branchId) return { data: [] };
      const r = await fetch(`/api/staff?branch_id=${branchId}&active=true`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const allStaff: StaffMember[] = staffData?.data ?? [];
  // Add any staff not in schedule map
  for (const s of allStaff) {
    if (!staffMap.has(s.id)) {
      staffMap.set(s.id, { name: s.fullName, role: s.role, days: new Map() });
    }
  }

  const sortedStaff = Array.from(staffMap.entries()).sort((a, b) => {
    const roleOrder = ["manager", "branch_manager", "hostess", "driver", "kitchen", "hall", "general"];
    return (roleOrder.indexOf(a[1].role) - roleOrder.indexOf(b[1].role)) || a[1].name.localeCompare(b[1].name);
  });

  const copyFromLastWeek = useMutation({
    mutationFn: async () => {
      const prev = new Date(effectiveFrom);
      prev.setDate(prev.getDate() - 7);
      await fetch("/api/schedules/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          branchId, fromDate: prev.toISOString().split("T")[0], toDate: effectiveFrom,
        }),
      });
    },
    onSuccess: () => {
      refetch();
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    },
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Schedule Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">Weekly shift schedule — click any cell to edit</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => copyFromLastWeek.mutate()}
              disabled={copyFromLastWeek.isPending}
              className="gap-2"
            >
              {copyMsg ? <><Check className="w-4 h-4" /> {copyMsg}</> : <><Copy className="w-4 h-4" /> Copy Last Week</>}
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-48">Staff</th>
                {DAYS.map((d, i) => (
                  <th key={i} className="text-center px-2 py-3 text-sm font-medium text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No staff found. Select a branch or add staff members first.
                  </td>
                </tr>
              ) : sortedStaff.map(([staffId, info]) => (
                <tr key={staffId} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{info.name}</p>
                      <Badge className={`text-[10px] border mt-0.5 ${ROLE_COLORS[info.role] ?? ROLE_COLORS.general}`}>
                        {info.role}
                      </Badge>
                    </div>
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                    const sched = info.days.get(dow);
                    return (
                      <td key={dow} className="px-1.5 py-2 text-center">
                        <button
                          onClick={() => setEditing({ staffId, staffName: info.name, dayOfWeek: dow, existing: sched })}
                          className={`w-full rounded-lg px-2 py-2 text-xs transition-all border ${
                            sched
                              ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
                              : "border-dashed border-white/10 text-muted-foreground/40 hover:border-white/20 hover:text-muted-foreground"
                          }`}
                        >
                          {sched ? (
                            <span>
                              {sched.shiftStart?.slice(0, 5)}<br />
                              <span className="text-muted-foreground">→ {sched.shiftEnd?.slice(0, 5)}</span>
                            </span>
                          ) : (
                            <span>+</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
          {Object.entries(ROLE_COLORS).map(([role, cls]) => (
            <div key={role} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full border ${cls}`} />
              <span className="capitalize">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <ShiftEditor
          staffId={editing.staffId}
          staffName={editing.staffName}
          dayOfWeek={editing.dayOfWeek}
          existing={editing.existing}
          effectiveFrom={effectiveFrom}
          token={token}
          onSave={() => { refetch(); setEditing(null); }}
          onDelete={() => { refetch(); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </DashboardLayout>
  );
}
