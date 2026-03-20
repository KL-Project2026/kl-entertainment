import { useState, useEffect, useRef, useCallback } from "react";
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
import { Calendar, Copy, X, Check, GripHorizontal } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLE_COLORS: Record<string, string> = {
  hostess: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  driver: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  branch_manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function getAuthHeader(token: string | null): HeadersInit {
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

interface DragState {
  staffId: string;
  staffName: string;
  staffRole: string;
  dayOfWeek: number;
  schedule: Schedule;
}

interface DropTarget {
  staffId: string;
  dow: number;
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

  // Drag state
  const dragRef = useRef<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [draggingCell, setDraggingCell] = useState<{ staffId: string; dow: number } | null>(null);
  const [isDropping, setIsDropping] = useState(false);

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

  const staffMap = new Map<string, { name: string; role: string; days: Map<number, Schedule> }>();
  for (const s of schedules) {
    if (!staffMap.has(s.staffId)) {
      staffMap.set(s.staffId, { name: s.staffName, role: s.staffRole, days: new Map() });
    }
    staffMap.get(s.staffId)!.days.set(s.dayOfWeek, s);
  }

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

  // ─── Drag handlers ───────────────────────────────────────────────
  const handleDragStart = useCallback((
    e: React.DragEvent,
    staffId: string,
    staffName: string,
    staffRole: string,
    dow: number,
    schedule: Schedule,
  ) => {
    dragRef.current = { staffId, staffName, staffRole, dayOfWeek: dow, schedule };
    setDraggingCell({ staffId, dow });
    setIsCopyMode(e.altKey);
    e.dataTransfer.effectAllowed = "copyMove";
    // Ghost image: small transparent element
    const ghost = document.createElement("div");
    ghost.style.cssText = `
      position: fixed; top: -1000px;
      background: hsl(var(--primary));
      color: white; font-size: 11px;
      padding: 4px 8px; border-radius: 6px;
      white-space: nowrap; pointer-events: none;
    `;
    ghost.textContent = `${schedule.shiftStart?.slice(0, 5)} → ${schedule.shiftEnd?.slice(0, 5)}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, staffId: string, dow: number) => {
    e.preventDefault();
    const copyMode = e.altKey;
    setIsCopyMode(copyMode);
    e.dataTransfer.dropEffect = copyMode ? "copy" : "move";
    setDropTarget({ staffId, dow });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }, []);

  const handleDrop = useCallback(async (
    e: React.DragEvent,
    targetStaffId: string,
    targetStaffName: string,
    targetDow: number,
    existingTargetSchedule?: Schedule,
  ) => {
    e.preventDefault();
    const drag = dragRef.current;
    if (!drag) return;

    // Same cell — do nothing
    if (drag.staffId === targetStaffId && drag.dayOfWeek === targetDow) {
      setDraggingCell(null);
      setDropTarget(null);
      return;
    }

    const copyMode = e.altKey;
    setIsDropping(true);

    try {
      // If there's already a schedule at target and we're moving — need to swap or overwrite
      // 1. Create/update at target
      await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          staffId: targetStaffId,
          dayOfWeek: targetDow,
          shiftStart: drag.schedule.shiftStart,
          shiftEnd: drag.schedule.shiftEnd,
          isOvernight: drag.schedule.isOvernight,
          effectiveFrom,
        }),
      });

      // 2. If MOVE (not copy) — delete the source
      if (!copyMode && drag.schedule.id) {
        await fetch(`/api/schedules/${drag.schedule.id}`, {
          method: "DELETE",
          headers: getAuthHeader(token),
        });
      }

      await refetch();
    } finally {
      setIsDropping(false);
      setDraggingCell(null);
      setDropTarget(null);
      dragRef.current = null;
    }
  }, [token, effectiveFrom, refetch]);

  const handleDragEnd = useCallback(() => {
    setDraggingCell(null);
    setDropTarget(null);
    dragRef.current = null;
  }, []);

  // Track Alt key globally during drag
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dragRef.current) setIsCopyMode(e.altKey);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Schedule Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Drag to move · <kbd className="text-[10px] bg-white/10 px-1 py-0.5 rounded border border-white/20">Alt</kbd> + drag to copy · click to edit
            </p>
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

        {/* Drop mode indicator */}
        {draggingCell && (
          <div className={`text-xs px-3 py-1.5 rounded-lg border w-fit transition-all ${
            isCopyMode
              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
              : "bg-primary/10 text-primary border-primary/30"
          }`}>
            {isCopyMode ? "📋 Copy mode — release to copy shift" : "↔ Move mode — hold Alt to copy instead"}
          </div>
        )}

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
                    const isDragging = draggingCell?.staffId === staffId && draggingCell?.dow === dow;
                    const isDropZone = dropTarget?.staffId === staffId && dropTarget?.dow === dow;
                    const isDropZoneActive = isDropZone && dragRef.current && !(dragRef.current.staffId === staffId && dragRef.current.dayOfWeek === dow);

                    return (
                      <td
                        key={dow}
                        className="px-1.5 py-2 text-center"
                        onDragOver={(e) => handleDragOver(e, staffId, dow)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, staffId, info.name, dow, sched)}
                      >
                        <div
                          className={`relative w-full rounded-lg transition-all ${
                            isDropZoneActive
                              ? isCopyMode
                                ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-black bg-blue-500/10"
                                : "ring-2 ring-primary ring-offset-1 ring-offset-black bg-primary/10"
                              : ""
                          }`}
                        >
                          {/* Copy badge on drop target */}
                          {isDropZoneActive && isCopyMode && (
                            <div className="absolute -top-2 -right-1 z-10 text-[9px] bg-blue-500 text-white rounded px-1 font-bold leading-4">
                              COPY
                            </div>
                          )}

                          {sched ? (
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, staffId, info.name, info.role, dow, sched)}
                              onDragEnd={handleDragEnd}
                              onClick={() => !isDragging && !isDropping && setEditing({ staffId, staffName: info.name, dayOfWeek: dow, existing: sched })}
                              className={`w-full rounded-lg px-2 py-2 text-xs border select-none
                                bg-primary/15 border-primary/30 text-primary
                                transition-all group
                                ${isDragging ? "opacity-30 scale-95" : "hover:bg-primary/25 cursor-grab active:cursor-grabbing"}
                                ${isDropZoneActive ? "pointer-events-none" : ""}
                              `}
                            >
                              <div className="flex items-center justify-center gap-0.5 mb-0.5 opacity-0 group-hover:opacity-40 transition-opacity">
                                <GripHorizontal className="w-3 h-3" />
                              </div>
                              <span>
                                {sched.shiftStart?.slice(0, 5)}<br />
                                <span className="text-muted-foreground">→ {sched.shiftEnd?.slice(0, 5)}</span>
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => !isDropping && setEditing({ staffId, staffName: info.name, dayOfWeek: dow, existing: sched })}
                              className={`w-full rounded-lg px-2 py-2 text-xs transition-all border
                                border-dashed border-white/10 text-muted-foreground/40
                                hover:border-white/20 hover:text-muted-foreground
                                ${isDropZoneActive ? "border-solid pointer-events-none" : ""}
                              `}
                            >
                              {isDropZoneActive ? (
                                <span className={isCopyMode ? "text-blue-400" : "text-primary"}>+</span>
                              ) : (
                                <span>+</span>
                              )}
                            </button>
                          )}
                        </div>
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
