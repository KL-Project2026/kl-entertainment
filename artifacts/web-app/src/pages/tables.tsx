import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutGrid, Plus, Search, BedDouble, Coffee, Grid2x2,
  Users, CheckCircle2, Wrench, XCircle, ChevronRight, Pencil,
  CalendarDays, List, Clock,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Branch { id: string; name: string; }
interface RoomTable {
  id: string; branch_id: string; branch_name: string;
  name: string; type: "ROOM" | "TABLE" | "BOOTH";
  capacity_min: number; capacity_max: number;
  description: string | null; amenities: string[];
  floor: string | null; status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "OUT_OF_ORDER";
  image_urls: string[]; sort_order: number;
  pricing_count: number;
  active_pricing: { id: string; priceLabel: string; priceType: string; basePrice: string; }[] | null;
}
interface Summary { total: number; active: number; maintenance: number; outOfOrder: number; inactive: number; }

interface AvailabilityReservation {
  reservation_id: string; guest_name: string;
  start_time: string; end_time: string | null;
  status: string; pax: number; revenue: number;
}
interface AvailabilityRoom {
  id: string; name: string; type: string; capacity_max: number; status: string;
  daily_revenue: number; currency_code: string;
  reservations: AvailabilityReservation[];
  applicable_price: { price_label: string; base_price: number; price_type: string; currency_code: string; } | null;
}
interface AvailabilityData {
  date: string; branch_id: string;
  room_tables: AvailabilityRoom[];
  daily_total_revenue: number; currency_code: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  ROOM:  <BedDouble className="w-4 h-4" />,
  TABLE: <Coffee className="w-4 h-4" />,
  BOOTH: <Grid2x2 className="w-4 h-4" />,
};
const TYPE_COLORS: Record<string, string> = {
  ROOM:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  TABLE: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  BOOTH: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};
const TYPE_COLORS_SOLID: Record<string, string> = {
  ROOM:  "bg-blue-500/70 border-blue-400/80 text-white",
  TABLE: "bg-orange-500/70 border-orange-400/80 text-white",
  BOOTH: "bg-purple-500/70 border-purple-400/80 text-white",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       "bg-green-500/20 text-green-300",
  INACTIVE:     "bg-gray-500/20 text-gray-400",
  MAINTENANCE:  "bg-yellow-500/20 text-yellow-300",
  OUT_OF_ORDER: "bg-red-500/20 text-red-300",
};
const PRICE_TYPE_LABELS: Record<string, string> = {
  PER_HOUR: "/hr", PER_SESSION: "/session", FLAT_RATE: "flat",
};
function fmtPrice(p: { priceType: string; basePrice: string }) {
  return `MYR ${parseFloat(p.basePrice).toFixed(0)}${PRICE_TYPE_LABELS[p.priceType] ?? ""}`;
}
function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

// ── Timeline helpers ───────────────────────────────────────────────────────
// Slots: 12:00 → 03:00 next day = 15 one-hour slots
const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => (i + 12) % 24);
const SLOT_WIDTH_PX = 64;
const ROW_HEIGHT_PX = 52;

function hourToMinutes(h: number) { return h < 12 ? h * 60 + 1440 : h * 60; }

function getSlotStyle(
  startTs: string, endTs: string | null,
  type: string
): { left: number; width: number; color: string } | null {
  const start = new Date(startTs);
  const end   = endTs ? new Date(endTs) : new Date(start.getTime() + 2 * 3600_000);

  const startH = start.getHours();
  const startM = start.getMinutes();
  const endH   = end.getHours();
  const endM   = end.getMinutes();

  const startMins = hourToMinutes(startH) + startM;
  const endMins   = hourToMinutes(endH)   + endM;
  const baseMins  = hourToMinutes(12);

  const leftMins  = startMins - baseMins;
  const widthMins = endMins - startMins;

  if (widthMins <= 0 || leftMins + widthMins <= 0 || leftMins >= 16 * 60) return null;

  const clampedLeft  = Math.max(0, leftMins);
  const clampedWidth = Math.min(widthMins, 16 * 60 - clampedLeft);

  return {
    left:  (clampedLeft  / 60) * SLOT_WIDTH_PX,
    width: (clampedWidth / 60) * SLOT_WIDTH_PX - 2,
    color: TYPE_COLORS_SOLID[type] ?? "bg-primary/70 border-primary text-white",
  };
}

// ── Availability Timeline ──────────────────────────────────────────────────
function AvailabilityTimeline({
  data, branches, branchFilter, setBranchFilter, date, setDate,
}: {
  data: AvailabilityData | null; branches: Branch[];
  branchFilter: string; setBranchFilter: (v: string) => void;
  date: string; setDate: (d: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{ res: AvailabilityReservation; x: number; y: number } | null>(null);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs mb-1 block">Date</Label>
          <DateInput value={date} onChange={e => setDate(e.target.value)} wrapperClassName="w-44" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Branch</Label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Select branch…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select a branch…</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {branchFilter === "__none__" && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Select a branch to view availability
        </div>
      )}

      {branchFilter !== "__none__" && !data && (
        <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
          Loading availability…
        </div>
      )}

      {branchFilter !== "__none__" && data && (
        <>
          {/* Timeline grid */}
          <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
            {/* Header: time slots */}
            <div className="flex border-b border-white/10 bg-white/5">
              <div className="shrink-0 w-36 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-white/10">
                Room / Table
              </div>
              <div className="flex overflow-x-auto">
                {HOUR_SLOTS.map(h => (
                  <div key={h} style={{ width: SLOT_WIDTH_PX, minWidth: SLOT_WIDTH_PX }}
                    className="py-2 text-center text-xs text-muted-foreground border-r border-white/5 shrink-0">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {data.room_tables.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No room tables found for this branch.
              </div>
            ) : (
              data.room_tables.map(rt => (
                <div key={rt.id} className="flex border-b border-white/5 last:border-0 group hover:bg-white/2 transition-colors"
                  style={{ height: ROW_HEIGHT_PX }}>
                  {/* Room label */}
                  <div className="shrink-0 w-36 px-3 flex flex-col justify-center border-r border-white/10">
                    <div className="text-xs font-medium truncate">{rt.name}</div>
                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit mt-0.5 ${STATUS_COLORS[rt.status]}`}>
                      {rt.status.replace("_", " ")}
                    </div>
                  </div>

                  {/* Timeline track */}
                  <div className="relative flex-1 overflow-x-auto">
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOUR_SLOTS.map(h => (
                        <div key={h} style={{ width: SLOT_WIDTH_PX, minWidth: SLOT_WIDTH_PX }}
                          className="h-full border-r border-white/5 shrink-0" />
                      ))}
                    </div>

                    {/* Reservation blocks */}
                    {rt.reservations.map((res) => {
                      const style = getSlotStyle(res.start_time, res.end_time, rt.type);
                      if (!style) return null;
                      return (
                        <div
                          key={res.reservation_id}
                          style={{ left: style.left, width: style.width, top: 6, height: ROW_HEIGHT_PX - 12 }}
                          className={`absolute rounded border text-[10px] px-1.5 py-0.5 cursor-pointer
                                      flex items-center gap-1 overflow-hidden truncate select-none
                                      ${style.color} shadow-sm`}
                          onMouseEnter={(e) => setTooltip({ res, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <Users className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate font-medium">{res.guest_name}</span>
                        </div>
                      );
                    })}

                    {rt.reservations.length === 0 && (
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[10px] text-muted-foreground/50">Available all day</span>
                      </div>
                    )}
                  </div>

                  {/* Daily revenue */}
                  <div className="shrink-0 w-24 px-2 flex flex-col justify-center items-end border-l border-white/10">
                    <div className="text-[10px] text-muted-foreground">Revenue</div>
                    <div className="text-xs font-semibold text-green-400">
                      {rt.daily_revenue > 0 ? `MYR ${rt.daily_revenue.toLocaleString("en-MY", { minimumFractionDigits: 0 })}` : "—"}
                    </div>
                    {rt.applicable_price && (
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        MYR {rt.applicable_price.base_price}{PRICE_TYPE_LABELS[rt.applicable_price.price_type] ?? ""}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Daily Revenue Summary */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Branch Daily Revenue ({date})</div>
                <div className="text-2xl font-bold text-green-400 mt-0.5">
                  MYR {data.daily_total_revenue.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Rooms</div>
                  <div className="font-semibold">{data.room_tables.filter(r => r.type === "ROOM").length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bookings</div>
                  <div className="font-semibold">{data.room_tables.reduce((s, r) => s + r.reservations.length, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Active</div>
                  <div className="font-semibold text-green-400">{data.room_tables.filter(r => r.status === "ACTIVE").length}</div>
                </div>
              </div>
            </div>

            {/* Per-room revenue breakdown */}
            {data.room_tables.filter(r => r.daily_revenue > 0).length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-muted-foreground mb-2">Revenue by room:</div>
                <div className="flex flex-wrap gap-2">
                  {data.room_tables.filter(r => r.daily_revenue > 0).map(r => (
                    <div key={r.id} className="flex items-center gap-1.5 text-xs bg-white/5 rounded-full px-2.5 py-1">
                      <span className={`text-[10px] px-1 rounded ${TYPE_COLORS[r.type]}`}>{r.type[0]}</span>
                      <span>{r.name}</span>
                      <span className="text-green-400 font-medium">
                        MYR {r.daily_revenue.toLocaleString("en-MY", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none bg-black/90 border border-white/20 rounded-lg p-3 text-xs shadow-xl"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
              <div className="font-semibold mb-1">{tooltip.res.guest_name}</div>
              <div className="text-muted-foreground space-y-0.5">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(tooltip.res.start_time).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                  {tooltip.res.end_time && ` → ${new Date(tooltip.res.end_time).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
                <div className="flex items-center gap-1"><Users className="w-3 h-3" /> {tooltip.res.pax} pax</div>
                <div className="capitalize">{tooltip.res.status}</div>
                {tooltip.res.revenue > 0 && (
                  <div className="text-green-400">MYR {tooltip.res.revenue.toFixed(2)}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
interface ModalState { id?: string; branchId: string; name: string; type: string;
  capacityMin: number; capacityMax: number; floor: string; description: string;
  amenities: string; status: string; }

const EMPTY_MODAL: ModalState = {
  branchId: "__none__", name: "", type: "ROOM",
  capacityMin: 1, capacityMax: 10, floor: "", description: "", amenities: "", status: "ACTIVE",
};

function RoomModal({
  initial, branches, onClose,
  onCreate, onUpdate,
}: {
  initial: ModalState;
  branches: Branch[];
  onClose: () => void;
  onCreate: (d: ModalState) => void;
  onUpdate: (d: ModalState) => void;
}) {
  const [form, setForm] = useState<ModalState>(initial);
  const isEdit = !!initial.id;
  const set = (k: keyof ModalState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.branchId || form.branchId === "__none__") return;
    if (!form.name.trim()) return;
    if (!form.type) return;
    if (form.capacityMax < form.capacityMin) return;
    isEdit ? onUpdate(form) : onCreate(form);
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Room / Table" : "Add Room / Table"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Branch *</Label>
            <Select value={form.branchId} onValueChange={v => set("branchId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input className="mt-1" value={form.name} onChange={e => set("name", e.target.value)} placeholder="VIP Room 1" />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOM">Room</SelectItem>
                  <SelectItem value="TABLE">Table</SelectItem>
                  <SelectItem value="BOOTH">Booth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Min Pax *</Label>
              <Input className="mt-1" type="number" min={1} value={form.capacityMin}
                onChange={e => set("capacityMin", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Max Pax *</Label>
              <Input className="mt-1" type="number" min={1} value={form.capacityMax}
                onChange={e => set("capacityMax", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Floor / Level</Label>
              <Input className="mt-1" value={form.floor} onChange={e => set("floor", e.target.value)} placeholder="Level 2" />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amenities</Label>
            <Input className="mt-1" value={form.amenities}
              onChange={e => set("amenities", e.target.value)}
              placeholder='Karaoke System, Private Bar, Smart TV (comma-separated)' />
            <p className="text-xs text-muted-foreground mt-1">Separate items with commas</p>
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={3} placeholder="Room description..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         ring-offset-background placeholder:text-muted-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}
            disabled={!form.name.trim() || form.branchId === "__none__" || form.capacityMax < form.capacityMin}>
            {isEdit ? "Save Changes" : "Add Room / Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Tables() {
  const [, navigate] = useLocation();
  const { token } = useAuthStore();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};
  const qc = useQueryClient();
  const { toast } = useToast();

  const [branchFilter, setBranchFilter] = useState("__all__");
  const [typeFilter, setTypeFilter]     = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [search, setSearch]             = useState("");
  const [modal, setModal]               = useState<ModalState | null>(null);

  // Availability view state
  const [viewMode, setViewMode]             = useState<"grid" | "availability">("grid");
  const [availDate, setAvailDate]           = useState<string>(todayStr());
  const [availBranch, setAvailBranch]       = useState<string>("__none__");

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => fetch("/api/branches", { headers: authH }).then(r => r.json()),
  });
  const branches: Branch[] = branchesData?.data ?? [];

  const params = new URLSearchParams();
  if (branchFilter !== "__all__") params.set("branch_id", branchFilter);
  if (typeFilter   !== "__all__") params.set("type",      typeFilter);
  if (statusFilter !== "__all__") params.set("status",    statusFilter);
  if (search.trim()) params.set("search", search.trim());

  const { data: roomData, isLoading } = useQuery({
    queryKey: ["room-tables", branchFilter, typeFilter, statusFilter, search],
    queryFn: () => fetch(`/api/room-tables?${params}`, { headers: authH }).then(r => r.json()),
  });
  const rooms: RoomTable[] = roomData?.data ?? [];
  const summary: Summary   = roomData?.summary ?? { total: 0, active: 0, maintenance: 0, outOfOrder: 0, inactive: 0 };

  // Availability query
  const { data: availRaw } = useQuery({
    queryKey: ["room-tables-availability", availDate, availBranch],
    queryFn: () =>
      availBranch === "__none__"
        ? Promise.resolve(null)
        : fetch(`/api/room-tables/availability?date=${availDate}&branch_id=${availBranch}`, { headers: authH })
            .then(r => r.json()),
    enabled: viewMode === "availability",
  });
  const availData: AvailabilityData | null = availRaw ?? null;

  const createMut = useMutation({
    mutationFn: async (d: ModalState) => {
      const r = await fetch("/api/room-tables", {
        method: "POST", headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: d.branchId, name: d.name.trim(), type: d.type,
          capacityMin: d.capacityMin, capacityMax: d.capacityMax,
          floor: d.floor.trim() || null, description: d.description.trim() || null,
          amenities: d.amenities ? d.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
          status: d.status,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-tables"] });
      setModal(null);
      toast({ title: "Room / Table added successfully" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (d: ModalState) => {
      const r = await fetch(`/api/room-tables/${d.id}`, {
        method: "PATCH", headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim(), type: d.type,
          capacityMin: d.capacityMin, capacityMax: d.capacityMax,
          floor: d.floor.trim() || null, description: d.description.trim() || null,
          amenities: d.amenities ? d.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
          status: d.status,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-tables"] });
      setModal(null);
      toast({ title: "Updated successfully" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setModal({ ...EMPTY_MODAL, branchId: branchFilter !== "__all__" ? branchFilter : "__none__" });
  }
  function openEdit(r: RoomTable) {
    setModal({
      id: r.id, branchId: r.branch_id, name: r.name, type: r.type,
      capacityMin: r.capacity_min, capacityMax: r.capacity_max,
      floor: r.floor ?? "", description: r.description ?? "",
      amenities: (r.amenities ?? []).join(", "), status: r.status,
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <LayoutGrid className="w-6 h-6" /> Room &amp; Table Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage rooms, tables &amp; booths across all branches
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <List className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("availability")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${viewMode === "availability" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <CalendarDays className="w-3.5 h-3.5" /> Availability
              </button>
            </div>
            {viewMode === "grid" && (
              <Button className="gap-2" onClick={openAdd}>
                <Plus className="w-4 h-4" /> Add Room / Table
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",       value: summary.total,       icon: <LayoutGrid className="w-4 h-4" />,    color: "text-primary" },
            { label: "Active",      value: summary.active,      icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-400" },
            { label: "Maintenance", value: summary.maintenance, icon: <Wrench className="w-4 h-4" />,        color: "text-yellow-400" },
            { label: "Out of Order",value: summary.outOfOrder,  icon: <XCircle className="w-4 h-4" />,       color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col gap-1">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${s.color}`}>
                {s.icon} {s.label}
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ─── AVAILABILITY VIEW ─────────────────────────────────────────── */}
        {viewMode === "availability" && (
          <AvailabilityTimeline
            data={availData}
            branches={branches}
            branchFilter={availBranch}
            setBranchFilter={setAvailBranch}
            date={availDate}
            setDate={setAvailDate}
          />
        )}

        {/* ─── GRID VIEW ─────────────────────────────────────────────────── */}
        {viewMode === "grid" && (
          <>
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, floor, description…" className="pl-9" />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  <SelectItem value="ROOM">Room</SelectItem>
                  <SelectItem value="TABLE">Table</SelectItem>
                  <SelectItem value="BOOTH">Booth</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[145px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-52 rounded-xl border border-white/10 bg-black/40 animate-pulse" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No rooms or tables found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(r => (
                  <div key={r.id}
                    className="rounded-xl border border-white/10 bg-black/40 hover:border-primary/40 transition-colors
                               flex flex-col overflow-hidden group">
                    {/* Card Header */}
                    <div className="p-4 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${TYPE_COLORS[r.type]}`}>
                          {TYPE_ICONS[r.type]} {r.type}
                        </span>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="px-4 pb-3 flex-1 space-y-2">
                      <h3 className="font-semibold text-base leading-tight">{r.name}</h3>
                      <p className="text-xs text-muted-foreground">{r.branch_name}</p>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r.capacity_min}–{r.capacity_max} pax</span>
                        {r.floor && <span>{r.floor}</span>}
                      </div>

                      {/* Amenities */}
                      {r.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.amenities.slice(0, 4).map(a => (
                            <span key={a} className="text-xs bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
                              {a}
                            </span>
                          ))}
                          {r.amenities.length > 4 && (
                            <span className="text-xs text-muted-foreground px-1">+{r.amenities.length - 4}</span>
                          )}
                        </div>
                      )}

                      {/* Pricing Preview */}
                      {r.active_pricing && r.active_pricing.length > 0 && (
                        <div className="text-xs text-primary font-medium">
                          from {fmtPrice(r.active_pricing[r.active_pricing.length - 1]!)}
                          {r.pricing_count > 1 && <span className="text-muted-foreground ml-1">({r.pricing_count} rules)</span>}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
                      <button onClick={() => openEdit(r)}
                        className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => navigate(`/tables/${r.id}`)}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors font-medium">
                        View Detail <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <RoomModal
          initial={modal}
          branches={branches}
          onClose={() => setModal(null)}
          onCreate={createMut.mutate}
          onUpdate={updateMut.mutate}
        />
      )}
    </DashboardLayout>
  );
}
