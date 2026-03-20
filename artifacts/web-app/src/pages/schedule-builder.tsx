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

// ─── Shift Editor Modal ───────────────────────────────────────────────────────
function ShiftEditor({
  staffId, staffName, dayOfWeek, existing, effectiveFrom, onSave, onDelete, onClose, token,
}: {
  staffId: string; staffName: string; dayOfWeek: number; existing?: Schedule;
  effectiveFrom: string; onSave: () => void; onDelete?: () => void;
  onClose: () => void; token: string | null;
}) {
  const [start, setStart] = useState(existing?.shiftStart?.slice(0, 5) ?? "18:00");
  const [end, setEnd] = useState(existing?.shiftEnd?.slice(0, 5) ?? "02:00");
  const [overnight, setOvernight] = useState(existing?.isOvernight ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
      body: JSON.stringify({ staffId, dayOfWeek, shiftStart: start, shiftEnd: end, isOvernight: overnight, effectiveFrom }),
    });
    setSaving(false);
    onSave();
  };

  const remove = async () => {
    if (!existing?.id) return;
    await fetch(`/api/schedules/${existing.id}`, { method: "DELETE", headers: getAuthHeader(token) });
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
          <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Shift"}</Button>
          {existing && (
            <Button variant="outline" className="text-red-400 border-red-500/30" onClick={remove}>Clear</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface DragState {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  schedule: Schedule;
  startX: number;
  startY: number;
  ghost: HTMLDivElement;
  isCopy: boolean;
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

  // Mouse-based drag state
  const drag = useRef<DragState | null>(null);
  const isDragging = useRef(false);
  const [activeTarget, setActiveTarget] = useState<{ staffId: string; dow: number } | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null); // "staffId:dow"
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
      const r = await fetch(`/api/schedules?branch_id=${branchId}&effective_date=${effectiveFrom}`, {
        headers: getAuthHeader(token),
      });
      return r.json() as Promise<{ data: Schedule[] }>;
    },
    enabled: !!branchId,
  });
  const schedules: Schedule[] = scheduleData?.data ?? [];

  const { data: staffData } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: async () => {
      if (!branchId) return { data: [] as StaffMember[] };
      const r = await fetch(`/api/staff?branch_id=${branchId}&active=true`, { headers: getAuthHeader(token) });
      return r.json() as Promise<{ data: StaffMember[] }>;
    },
    enabled: !!branchId,
  });
  const allStaff: StaffMember[] = staffData?.data ?? [];

  // Build staff map
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
        body: JSON.stringify({ branchId, fromDate: prev.toISOString().split("T")[0], toDate: effectiveFrom }),
      });
    },
    onSuccess: () => {
      refetch();
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    },
  });

  // ─── Find drop target from point ─────────────────────────────────
  const findDropCell = (x: number, y: number) => {
    // Temporarily hide ghost so elementFromPoint sees the actual cell underneath
    const ghost = drag.current?.ghost;
    if (ghost) ghost.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = "";

    // Walk up the DOM to find a cell with data-cell attribute
    let node = el as HTMLElement | null;
    while (node && node !== document.body) {
      const staffId = node.dataset.staffid;
      const dow = node.dataset.dow;
      if (staffId && dow !== undefined) {
        return { staffId, dow: parseInt(dow, 10) };
      }
      node = node.parentElement;
    }
    return null;
  };

  // ─── Global mouse handlers ────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // Start drag after 5px threshold
    if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 5) {
      isDragging.current = true;
      setDraggingKey(`${d.staffId}:${d.dayOfWeek}`);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    if (!isDragging.current) return;

    // Move ghost
    d.ghost.style.left = `${e.clientX + 12}px`;
    d.ghost.style.top = `${e.clientY - 16}px`;

    // Detect copy mode (Alt key)
    const cm = e.altKey;
    if (cm !== d.isCopy) {
      d.isCopy = cm;
      setCopyMode(cm);
      d.ghost.textContent = cm
        ? `📋 ${d.schedule.shiftStart?.slice(0, 5)} → ${d.schedule.shiftEnd?.slice(0, 5)}`
        : `${d.schedule.shiftStart?.slice(0, 5)} → ${d.schedule.shiftEnd?.slice(0, 5)}`;
      d.ghost.style.background = cm ? "#3b82f6" : "hsl(var(--primary))";
    }

    // Find cell under cursor
    const cell = findDropCell(e.clientX, e.clientY);
    if (cell && !(cell.staffId === d.staffId && cell.dow === d.dayOfWeek)) {
      setActiveTarget(cell);
    } else {
      setActiveTarget(null);
    }
  }, []);

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    const d = drag.current;
    const wasDragging = isDragging.current;

    // Cleanup ghost & cursor
    if (d?.ghost && document.body.contains(d.ghost)) document.body.removeChild(d.ghost);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    isDragging.current = false;
    drag.current = null;
    setDraggingKey(null);
    setActiveTarget(null);
    setCopyMode(false);

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    if (!wasDragging || !d || busy) return;

    const cell = findDropCell(e.clientX, e.clientY);
    if (!cell || (cell.staffId === d.staffId && cell.dow === d.dayOfWeek)) return;

    const isCopy = e.altKey || d.isCopy;
    setBusy(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          staffId: cell.staffId,
          dayOfWeek: cell.dow,
          shiftStart: d.schedule.shiftStart,
          shiftEnd: d.schedule.shiftEnd,
          isOvernight: d.schedule.isOvernight,
          effectiveFrom,
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      if (!isCopy && d.schedule.id) {
        await fetch(`/api/schedules/${d.schedule.id}`, {
          method: "DELETE",
          headers: getAuthHeader(token),
        });
      }
      await refetch();
    } catch (err) {
      console.error("[schedule drag] error:", err);
    } finally {
      setBusy(false);
    }
  }, [handleMouseMove, token, effectiveFrom, refetch, busy]);

  // ─── Start drag on mousedown ──────────────────────────────────────
  const startDrag = useCallback((
    e: React.MouseEvent,
    staffId: string,
    staffName: string,
    dayOfWeek: number,
    schedule: Schedule,
  ) => {
    // Only left-button
    if (e.button !== 0) return;

    // Create ghost element
    const ghost = document.createElement("div");
    ghost.textContent = `${schedule.shiftStart?.slice(0, 5)} → ${schedule.shiftEnd?.slice(0, 5)}`;
    ghost.style.cssText = `
      position: fixed;
      left: ${e.clientX + 12}px;
      top: ${e.clientY - 16}px;
      background: hsl(var(--primary));
      color: #000;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      pointer-events: none;
      z-index: 9999;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: none;
    `;
    document.body.appendChild(ghost);

    drag.current = {
      staffId, staffName, dayOfWeek, schedule,
      startX: e.clientX, startY: e.clientY,
      ghost, isCopy: false,
    };
    isDragging.current = false;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (drag.current?.ghost && document.body.contains(drag.current.ghost)) {
        document.body.removeChild(drag.current.ghost);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Cell renderer ────────────────────────────────────────────────
  const renderCell = (staffId: string, staffName: string, dow: number, sched: Schedule | undefined) => {
    const key = `${staffId}:${dow}`;
    const isSource = draggingKey === key;
    const isTarget = activeTarget?.staffId === staffId && activeTarget?.dow === dow;

    return (
      <div
        data-staffid={staffId}
        data-dow={String(dow)}
        className={`relative w-full rounded-lg transition-all duration-100 ${
          isTarget
            ? copyMode
              ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-background bg-blue-500/10"
              : "ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/10"
            : ""
        }`}
      >
        {/* Target label */}
        {isTarget && (
          <span className={`absolute -top-2 -right-1 z-10 text-[9px] rounded px-1 font-bold leading-4 pointer-events-none ${
            copyMode ? "bg-blue-500 text-white" : "bg-primary text-black"
          }`}>
            {copyMode ? "COPY" : "MOVE"}
          </span>
        )}

        {sched ? (
          <div
            data-staffid={staffId}
            data-dow={String(dow)}
            onMouseDown={(e) => startDrag(e, staffId, staffName, dow, sched)}
            onClick={() => {
              // Don't open editor if we just finished a drag
              if (isDragging.current || busy) return;
              setEditing({ staffId, staffName, dayOfWeek: dow, existing: sched });
            }}
            className={`
              w-full rounded-lg px-2 py-2 text-xs border select-none
              transition-all duration-100 cursor-grab active:cursor-grabbing
              ${isSource
                ? "opacity-25 bg-primary/5 border-primary/10"
                : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
              }
            `}
          >
            <span className="block leading-tight pointer-events-none">
              {sched.shiftStart?.slice(0, 5)}<br />
              <span className="text-muted-foreground">→ {sched.shiftEnd?.slice(0, 5)}</span>
            </span>
          </div>
        ) : (
          <button
            data-staffid={staffId}
            data-dow={String(dow)}
            onClick={() => {
              if (busy) return;
              setEditing({ staffId, staffName, dayOfWeek: dow, existing: undefined });
            }}
            className={`
              w-full rounded-lg px-2 py-2.5 text-xs border transition-all duration-100
              ${isTarget
                ? copyMode
                  ? "border-blue-400/50 text-blue-400"
                  : "border-primary/50 text-primary"
                : "border-dashed border-white/10 text-muted-foreground/40 hover:border-white/20 hover:text-muted-foreground"
              }
            `}
          >
            +
          </button>
        )}
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
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="w-40" />
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

        {/* Mode banner */}
        {draggingKey && (
          <div className={`text-xs px-3 py-1.5 rounded-lg border w-fit ${
            copyMode ? "bg-blue-500/10 text-blue-300 border-blue-500/30" : "bg-primary/10 text-primary border-primary/30"
          }`}>
            {copyMode ? "📋 Copy mode — release to copy" : "↔ Move mode — hold Alt to copy"}
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
