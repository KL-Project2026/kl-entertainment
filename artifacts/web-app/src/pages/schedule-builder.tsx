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
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Copy, X, Check } from "lucide-react";

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

interface DragPayload {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  schedule: Schedule;
}

export default function ScheduleBuilder() {
  const { token, user } = useAuthStore();
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const d = new Date();
    const mon = new Date(d.setDate(d.getDate() - d.getDay() + 1));
    return mon.toISOString().split("T")[0];
  });
  const [editing, setEditing] = useState<{
    staffId: string; staffName: string; dayOfWeek: number; existing?: Schedule;
  } | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  // Drag state — use refs to avoid stale closures
  const dragPayload = useRef<DragPayload | null>(null);
  const didDrag = useRef(false); // prevent click firing after drag
  const [dropTarget, setDropTarget] = useState<{ staffId: string; dow: number } | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<{ staffId: string; dow: number } | null>(null);
  const [copyMode, setCopyMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json() as Promise<{ data: Array<{ id: string; name: string }> }>;
    },
  });
  const branches = branchesData?.data ?? [];

  useEffect(() => {
    if (!branchId && branches.length) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const { data: scheduleData, refetch } = useQuery({
    queryKey: ["schedules", branchId, effectiveFrom],
    queryFn: async () => {
      if (!branchId) return { data: [] as Schedule[] };
      const r = await fetch(
        `/api/schedules?branch_id=${branchId}&effective_date=${effectiveFrom}`,
        { headers: getAuthHeader(token) },
      );
      return r.json() as Promise<{ data: Schedule[] }>;
    },
    enabled: !!branchId,
  });
  const schedules: Schedule[] = scheduleData?.data ?? [];

  const { data: staffData } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: async () => {
      if (!branchId) return { data: [] as StaffMember[] };
      const r = await fetch(
        `/api/staff?branch_id=${branchId}&active=true`,
        { headers: getAuthHeader(token) },
      );
      return r.json() as Promise<{ data: StaffMember[] }>;
    },
    enabled: !!branchId,
  });
  const allStaff: StaffMember[] = staffData?.data ?? [];

  // Build staff→day map
  const staffMap = new Map<string, { name: string; role: string; days: Map<number, Schedule> }>();
  for (const s of schedules) {
    if (!staffMap.has(s.staffId))
      staffMap.set(s.staffId, { name: s.staffName, role: s.staffRole, days: new Map() });
    staffMap.get(s.staffId)!.days.set(s.dayOfWeek, s);
  }
  for (const s of allStaff) {
    if (!staffMap.has(s.id))
      staffMap.set(s.id, { name: s.fullName, role: s.role, days: new Map() });
  }
  const sortedStaff = Array.from(staffMap.entries()).sort((a, b) => {
    const order = ["manager", "branch_manager", "hostess", "driver", "kitchen", "hall", "general"];
    return (order.indexOf(a[1].role) - order.indexOf(b[1].role)) || a[1].name.localeCompare(b[1].name);
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

  // ─── Drag handlers ────────────────────────────────────────────────

  const onDragStart = useCallback((
    e: React.DragEvent,
    payload: DragPayload,
  ) => {
    dragPayload.current = payload;
    didDrag.current = false;
    // REQUIRED for Firefox — drag won't start without setData
    e.dataTransfer.setData("text/plain", JSON.stringify({
      staffId: payload.staffId,
      dayOfWeek: payload.dayOfWeek,
    }));
    e.dataTransfer.effectAllowed = "copyMove";
    setDraggingFrom({ staffId: payload.staffId, dow: payload.dayOfWeek });
    setCopyMode(e.altKey);
  }, []);

  const onDragEnd = useCallback(() => {
    didDrag.current = true;
    dragPayload.current = null;
    setDraggingFrom(null);
    setDropTarget(null);
    setCopyMode(false);
    // allow click-after-drag guard to reset
    setTimeout(() => { didDrag.current = false; }, 200);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, staffId: string, dow: number) => {
    // Must prevent default to allow dropping
    e.preventDefault();
    e.stopPropagation();
    const cm = e.altKey;
    setCopyMode(cm);
    e.dataTransfer.dropEffect = cm ? "copy" : "move";
    setDropTarget({ staffId, dow });
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the cell entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }, []);

  const onDrop = useCallback(async (
    e: React.DragEvent,
    targetStaffId: string,
    targetDow: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = dragPayload.current;
    if (!drag || busy) return;

    setDropTarget(null);
    setDraggingFrom(null);

    // Same cell — no-op
    if (drag.staffId === targetStaffId && drag.dayOfWeek === targetDow) return;

    const isCopy = e.altKey;
    setBusy(true);
    dragPayload.current = null;

    try {
      // 1. Save shift at target cell
      const res = await fetch("/api/schedules", {
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
      if (!res.ok) throw new Error("Failed to save");

      // 2. Delete source if moving (not copying)
      if (!isCopy && drag.schedule.id) {
        await fetch(`/api/schedules/${drag.schedule.id}`, {
          method: "DELETE",
          headers: getAuthHeader(token),
        });
      }

      await refetch();
    } catch (err) {
      console.error("[schedule] drag drop failed:", err);
    } finally {
      setBusy(false);
    }
  }, [token, effectiveFrom, refetch, busy]);

  // Track Alt key globally while dragging
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (draggingFrom) setCopyMode(e.altKey);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, [draggingFrom]);

  // ─── Cell render helper ───────────────────────────────────────────

  const renderCell = (staffId: string, staffName: string, dow: number, sched: Schedule | undefined) => {
    const isSource = draggingFrom?.staffId === staffId && draggingFrom?.dow === dow;
    const isTarget = dropTarget?.staffId === staffId && dropTarget?.dow === dow;
    const isActiveTarget = isTarget && dragPayload.current &&
      !(dragPayload.current.staffId === staffId && dragPayload.current.dayOfWeek === dow);

    const cellDragHandlers = {
      onDragOver: (e: React.DragEvent) => onDragOver(e, staffId, dow),
      onDragLeave,
      onDrop: (e: React.DragEvent) => onDrop(e, staffId, dow),
    };

    const targetRingClass = isActiveTarget
      ? copyMode
        ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-background bg-blue-500/10"
        : "ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/10"
      : "";

    if (sched) {
      return (
        <div
          {...cellDragHandlers}
          className={`relative w-full rounded-lg transition-all duration-150 ${targetRingClass}`}
        >
          {isActiveTarget && copyMode && (
            <span className="absolute -top-2 -right-1 z-10 text-[9px] bg-blue-500 text-white rounded px-1 font-bold leading-4 pointer-events-none">
              COPY
            </span>
          )}
          <div
            draggable
            onDragStart={(e) => onDragStart(e, { staffId, staffName, dayOfWeek: dow, schedule: sched })}
            onDragEnd={onDragEnd}
            onClick={() => {
              if (didDrag.current || busy) return;
              setEditing({ staffId, staffName, dayOfWeek: dow, existing: sched });
            }}
            className={`
              w-full rounded-lg px-2 py-2 text-xs border cursor-grab active:cursor-grabbing
              transition-all duration-150
              ${isSource
                ? "opacity-30 bg-primary/10 border-primary/20"
                : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
              }
            `}
          >
            <span className="block leading-tight">
              {sched.shiftStart?.slice(0, 5)}<br />
              <span className="text-muted-foreground">→ {sched.shiftEnd?.slice(0, 5)}</span>
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        {...cellDragHandlers}
        className={`relative w-full rounded-lg transition-all duration-150 ${targetRingClass}`}
      >
        {isActiveTarget && !copyMode && (
          <span className="absolute -top-2 -right-1 z-10 text-[9px] bg-primary text-black rounded px-1 font-bold leading-4 pointer-events-none">
            MOVE
          </span>
        )}
        <button
          onClick={() => {
            if (didDrag.current || busy) return;
            setEditing({ staffId, staffName, dayOfWeek: dow, existing: undefined });
          }}
          className={`
            w-full rounded-lg px-2 py-2.5 text-xs border transition-all duration-150
            ${isActiveTarget
              ? copyMode
                ? "border-blue-400/50 text-blue-400"
                : "border-primary/50 text-primary"
              : "border-dashed border-white/10 text-muted-foreground/40 hover:border-white/20 hover:text-muted-foreground"
            }
          `}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Schedule Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Drag to move &middot;{" "}
              <kbd className="text-[10px] bg-white/10 px-1 py-0.5 rounded border border-white/20">Alt</kbd>
              {" "}+ drag to copy &middot; click to edit
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
                type="date" value={effectiveFrom}
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
              {copyMsg
                ? <><Check className="w-4 h-4" /> {copyMsg}</>
                : <><Copy className="w-4 h-4" /> Copy Last Week</>}
            </Button>
          </div>
        </div>

        {/* Drag mode banner */}
        {draggingFrom && (
          <div className={`text-xs px-3 py-1.5 rounded-lg border w-fit transition-all ${
            copyMode
              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
              : "bg-primary/10 text-primary border-primary/30"
          }`}>
            {copyMode ? "📋 Copy mode — release to copy" : "↔ Move mode — hold Alt to copy instead"}
          </div>
        )}

        {/* Grid */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-48">Staff</th>
                {DAYS.map((d, i) => (
                  <th key={i} className="text-center px-2 py-3 text-sm font-medium text-muted-foreground">{d}</th>
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
                <tr key={staffId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium">{info.name}</p>
                    <Badge className={`text-[10px] border mt-0.5 ${ROLE_COLORS[info.role] ?? ROLE_COLORS.general}`}>
                      {info.role}
                    </Badge>
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                    <td key={dow} className="px-1.5 py-2 text-center">
                      {renderCell(staffId, info.name, dow, info.days.get(dow))}
                    </td>
                  ))}
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
