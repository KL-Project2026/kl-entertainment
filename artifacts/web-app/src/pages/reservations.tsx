import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useListBranches, useListReservations, useConfirmReservation, useCheckInReservation, useCheckOutReservation, useCancelReservation } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Card, Button, Badge, Input } from "@/components/ui";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, CalendarDays, Users, Clock, DoorOpen, ShoppingCart, X, History, TrendingUp, BarChart3, ChevronRight } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getListReservationsQueryKey } from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  tentative:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled:   "bg-red-500/15 text-red-400 border-red-500/30",
  no_show:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const STATUS_TEXT: Record<string, string> = {
  tentative: "text-yellow-400", confirmed: "text-blue-400",
  checked_in: "text-emerald-400", extended: "text-cyan-400",
  checked_out: "text-gray-400", cancelled: "text-red-400", no_show: "text-orange-400",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  room_charge: "Room Charge", pos_item: "POS / F&B",
  hostess_charge: "Hostess", outcall_fee: "Out-Call",
  late_charge: "Late Charge", sst: "SST",
  service_charge: "Service Charge", discount: "Discount", other: "Other",
};

const ENTRY_TYPE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  room_charge:    { bg: "rgba(59,130,246,0.12)",  text: "#93c5fd", bar: "#3b82f6" },
  pos_item:       { bg: "rgba(168,85,247,0.12)",  text: "#c4b5fd", bar: "#a855f7" },
  hostess_charge: { bg: "rgba(236,72,153,0.12)",  text: "#f9a8d4", bar: "#ec4899" },
  outcall_fee:    { bg: "rgba(251,146,60,0.12)",  text: "#fdba74", bar: "#f97316" },
  late_charge:    { bg: "rgba(251,191,36,0.12)",  text: "#fde68a", bar: "#f59e0b" },
  sst:            { bg: "rgba(20,184,166,0.12)",  text: "#5eead4", bar: "#14b8a6" },
  service_charge: { bg: "rgba(16,185,129,0.12)",  text: "#6ee7b7", bar: "#10b981" },
  discount:       { bg: "rgba(239,68,68,0.12)",   text: "#fca5a5", bar: "#ef4444" },
  other:          { bg: "rgba(107,114,128,0.12)", text: "#d1d5db", bar: "#6b7280" },
};

const RESERVATION_STATUS_OPTIONS = [
  { value: "tentative",   label: "Tentative" },
  { value: "confirmed",   label: "Confirmed" },
  { value: "checked_in",  label: "Checked In" },
  { value: "extended",    label: "Extended" },
  { value: "checked_out", label: "Checked Out" },
  { value: "cancelled",   label: "Cancelled" },
  { value: "no_show",     label: "No Show" },
];

// ─── CancelModal ─────────────────────────────────────────────────────────────
function CancelModal({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelReservation();
  const queryClient = useQueryClient();

  const handleCancel = async () => {
    await cancelMutation.mutateAsync({ id: reservation.id, data: { reason } });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg font-bold">Cancel Reservation</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Cancel <span className="text-foreground font-semibold">{reservation.reservationNo}</span> for{" "}
          {reservation.customerName || "Walk-in"}?
        </p>
        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">Reason (optional)</label>
          <Input placeholder="Cancellation reason..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Keep</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending} className="flex-1">
            {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── ReservationCard (Today tab) ─────────────────────────────────────────────
function ReservationCard({ reservation }: { reservation: Reservation }) {
  const [, navigate] = useLocation();
  const [showCancel, setShowCancel] = useState(false);
  const queryClient = useQueryClient();
  const confirmMut   = useConfirmReservation();
  const checkInMut   = useCheckInReservation();
  const checkOutMut  = useCheckOutReservation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });

  const startTime = new Date(reservation.startTime);
  const isBusy = confirmMut.isPending || checkInMut.isPending || checkOutMut.isPending;

  return (
    <>
      <Card className="p-5 flex flex-col gap-4 hover:border-primary/20 transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-lg font-bold">{reservation.reservationNo}</span>
              <StatusBadge status={reservation.status} />
            </div>
            <p className="text-sm text-muted-foreground">{reservation.customerName || "Walk-in Guest"}</p>
            {reservation.customerPhone && (
              <p className="text-xs text-muted-foreground mt-0.5">{reservation.customerPhone}</p>
            )}
          </div>
          {reservation.roomName && (
            <div className="text-right">
              <p className="text-primary font-semibold text-sm">{reservation.roomName}</p>
              <p className="text-xs text-muted-foreground capitalize">{reservation.roomType?.replace("_", " ")}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-black/30 rounded-lg p-2.5 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary/70" />
            <span className="text-xs">{startTime.toLocaleDateString()}</span>
          </div>
          <div className="bg-black/30 rounded-lg p-2.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary/70" />
            <span className="text-xs">{startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="bg-black/30 rounded-lg p-2.5 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary/70" />
            <span className="text-xs">{reservation.guestCount} guests</span>
          </div>
        </div>

        {reservation.depositPaid && (
          <div className="text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            Deposit Paid: MYR {Number(reservation.depositAmount).toFixed(2)}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {reservation.status === "tentative" && (
            <Button size="sm" onClick={async () => { await confirmMut.mutateAsync({ id: reservation.id }); invalidate(); }} disabled={isBusy} className="flex-1">Confirm</Button>
          )}
          {reservation.status === "confirmed" && (
            <Button size="sm" onClick={async () => { await checkInMut.mutateAsync({ id: reservation.id }); invalidate(); }} disabled={isBusy} className="flex-1 gap-1.5">
              <DoorOpen className="w-3.5 h-3.5" /> Check In
            </Button>
          )}
          {(reservation.status === "checked_in" || reservation.status === "extended") && (
            <>
              <Button size="sm" variant="outline" onClick={() => navigate(`/pos?reservationId=${reservation.id}`)} className="flex-1 gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" /> POS
              </Button>
              <Button size="sm" onClick={async () => { await checkOutMut.mutateAsync({ id: reservation.id }); invalidate(); }} disabled={isBusy} className="flex-1">Check Out</Button>
            </>
          )}
          {["tentative", "confirmed"].includes(reservation.status) && (
            <Button size="sm" variant="ghost" onClick={() => setShowCancel(true)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </Card>
      {showCancel && <CancelModal reservation={reservation} onClose={() => setShowCancel(false)} />}
    </>
  );
}

// ─── Table columns (Today tab) ────────────────────────────────────────────────
const RESERVATION_COLUMNS: ColumnDef<Record<string, unknown>>[] = [
  { key: "reservationNo", label: "Booking #", render: (row) => <span className="font-mono text-xs text-primary">{row.reservationNo as string}</span> },
  { key: "status",        label: "Status",    render: (row) => <StatusBadge status={row.status as string} /> },
  { key: "customerName",  label: "Customer",  render: (row) => (
    <div><p className="font-medium">{(row.customerName as string) || "Walk-in"}</p>
    {row.customerPhone && <p className="text-xs text-muted-foreground">{row.customerPhone as string}</p>}</div>
  )},
  { key: "roomName",      label: "Room",      render: (row) => (
    <div><p>{(row.roomName as string) || "—"}</p>
    {row.roomType && <p className="text-xs text-muted-foreground capitalize">{(row.roomType as string).replace("_", " ")}</p>}</div>
  )},
  { key: "startTime",     label: "Date",      render: (row) => <span>{formatDate(row.startTime as string)}</span> },
  { key: "startTime_time",label: "Time",      render: (row) => <span className="tabular-nums">{new Date(row.startTime as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> },
  { key: "guestCount",    label: "Guests" },
  { key: "depositPaid",   label: "Deposit",   render: (row) => row.depositPaid
    ? <span className="text-emerald-400">RM {parseFloat((row.depositAmount as string) || "0").toFixed(2)}</span>
    : <span className="text-muted-foreground/50">—</span>
  },
];

// ─── History types ────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string; reservationNo: string; customerName: string | null; customerPhone: string | null;
  roomName: string | null; roomType: string | null; status: string;
  startTime: string; endTime: string; guestCount: number;
  depositAmount: number; depositPaid: boolean; folioTotal: number;
}
interface HistorySummary {
  total: number;
  byStatus: { status: string; count: number }[];
  totalRevenue: number;
  byType: { type: string; total: number }[];
}
interface HistoryData { reservations: HistoryEntry[]; summary: HistorySummary }

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ branches }: { branches: { id: string; name: string }[] }) {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const token = (useAuthStore.getState() as { token?: string }).token ?? localStorage.getItem("accessToken") ?? "";

  const today = new Date().toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [branchId,  setBranchId]  = useState(user?.branchId || "");
  const [dateFrom,  setDateFrom]  = useState(lastWeek);
  const [dateTo,    setDateTo]    = useState(today);
  const [statusF,   setStatusF]   = useState("");
  const [applied,   setApplied]   = useState({ branchId: user?.branchId || "", dateFrom: lastWeek, dateTo: today, status: "" });
  const [sortCol,   setSortCol]   = useState<"startTime" | "folioTotal">("startTime");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [search,    setSearch]    = useState("");

  const { data, isLoading, isFetching } = useQuery<HistoryData>({
    queryKey: ["reservations-history", applied],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("date_from", applied.dateFrom);
      qs.set("date_to",   applied.dateTo);
      if (applied.branchId) qs.set("branch_id", applied.branchId);
      if (applied.status)   qs.set("status",    applied.status);
      const r = await fetch(`/api/reservations/history?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j.data as HistoryData;
    },
    staleTime: 60_000,
  });

  const apply = useCallback(() => {
    setApplied({ branchId, dateFrom, dateTo, status: statusF });
  }, [branchId, dateFrom, dateTo, statusF]);

  const reservations = (data?.reservations ?? [])
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.reservationNo?.toLowerCase().includes(q) ||
              (r.customerName ?? "").toLowerCase().includes(q) ||
              (r.customerPhone ?? "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortCol === "folioTotal") return mul * (a.folioTotal - b.folioTotal);
      return mul * (new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });

  const summary = data?.summary;

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const periodDays = Math.max(1, Math.ceil((new Date(applied.dateTo).getTime() - new Date(applied.dateFrom).getTime()) / 86400000) + 1);

  return (
    <div className="space-y-5">
      {/* ── Filter bar ── */}
      <Card className="bg-black/40 border-white/5 px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">Branch</p>
            <Select value={branchId || "__all__"} onValueChange={v => setBranchId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-44 bg-black/30 h-10">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">From</p>
            <DateInput value={dateFrom} onChange={e => setDateFrom(e.target.value)} wrapperClassName="w-40" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">To</p>
            <DateInput value={dateTo} onChange={e => setDateTo(e.target.value)} wrapperClassName="w-40" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">Status</p>
            <Select value={statusF || "__all__"} onValueChange={v => setStatusF(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40 bg-black/30 h-10">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                {RESERVATION_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={apply} disabled={isFetching} className="h-10 px-6 gap-2">
            {isFetching ? "Loading…" : "Apply"}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white/5 rounded-xl" />)}
        </div>
      ) : summary ? (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total count */}
            <Card className="bg-black/40 border-white/5 px-5 py-4 flex flex-col gap-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Bookings</p>
              <p className="text-3xl font-display font-bold text-primary">{summary.total}</p>
              <p className="text-xs text-muted-foreground">{periodDays} day{periodDays !== 1 ? "s" : ""} • avg {(summary.total / periodDays).toFixed(1)}/day</p>
            </Card>

            {/* Total revenue */}
            <Card className="bg-black/40 border-white/5 px-5 py-4 flex flex-col gap-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Revenue</p>
              <p className="text-3xl font-display font-bold text-primary">{formatCurrency(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">
                {summary.total > 0 ? `avg ${formatCurrency(summary.totalRevenue / summary.total)}/booking` : "No bookings"}
              </p>
            </Card>

            {/* Status breakdown */}
            <Card className="bg-black/40 border-white/5 px-5 py-4 col-span-2 md:col-span-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3">By Status</p>
              <div className="flex flex-wrap gap-2">
                {summary.byStatus.map(s => (
                  <div key={s.status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[s.status] || "bg-white/5 text-white border-white/10"}`}>
                    <span className="font-bold">{s.count}</span>
                    <span className="capitalize opacity-80">{s.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Revenue by type ── */}
          {summary.byType.length > 0 && (
            <Card className="bg-black/40 border-white/5 px-5 py-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Revenue Breakdown by Type</p>
                <span className="ml-auto text-xs text-muted-foreground">{formatCurrency(summary.totalRevenue)} total</span>
              </div>
              <div className="space-y-3">
                {summary.byType.map(t => {
                  const colors = ENTRY_TYPE_COLORS[t.type] ?? ENTRY_TYPE_COLORS.other;
                  const pct = summary.totalRevenue > 0 ? (t.total / summary.totalRevenue) * 100 : 0;
                  return (
                    <div key={t.type} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 shrink-0" style={{ color: colors.text }}>
                        {ENTRY_TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, background: colors.bar + "cc" }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-right w-24 shrink-0" style={{ color: colors.text }}>
                        {formatCurrency(t.total)}
                      </span>
                      <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── Search + Table ── */}
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <History className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{reservations.length} Reservations</span>
              <div className="ml-auto">
                <Input
                  placeholder="Search booking# / customer…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 w-52 text-sm bg-black/30"
                />
              </div>
            </div>

            {reservations.length === 0 ? (
              <div className="py-16 text-center">
                <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reservations found for selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      {[
                        { label: "Booking #",   key: null },
                        { label: "Status",      key: null },
                        { label: "Customer",    key: null },
                        { label: "Room",        key: null },
                        { label: "Date / Time", key: "startTime" as const },
                        { label: "Guests",      key: null },
                        { label: "Folio Total", key: "folioTotal" as const },
                      ].map((h, i) => (
                        <th key={i}
                          className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${h.key ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                          onClick={() => h.key && toggleSort(h.key)}
                        >
                          <span className="flex items-center gap-1">
                            {h.label}
                            {h.key && sortCol === h.key && (
                              <span className="text-primary">{sortDir === "desc" ? "↓" : "↑"}</span>
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r, idx) => (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/reservations/${r.id}`)}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                        style={{ borderBottom: idx === reservations.length - 1 ? "none" : undefined }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-primary">{r.reservationNo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold capitalize ${STATUS_TEXT[r.status] || "text-muted-foreground"}`}>
                            {r.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{r.customerName || "Walk-in"}</p>
                          {r.customerPhone && <p className="text-xs text-muted-foreground">{r.customerPhone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{r.roomName || "—"}</p>
                          {r.roomType && <p className="text-xs text-muted-foreground capitalize">{r.roomType.replace("_", " ")}</p>}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <p className="text-sm">{formatDate(r.startTime)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.guestCount}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {r.folioTotal > 0
                            ? <span className="text-sm font-semibold text-primary">{formatCurrency(r.folioTotal)}</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.02]">
                      <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(reservations.reduce((s, r) => s + r.folioTotal, 0))}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Reservations() {
  const [, navigate]  = useLocation();
  const { user }      = useAuthStore();
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  // Today tab state
  const [branchId,     setBranchId]     = useState(user?.branchId || "");
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [serverStatus, setServerStatus] = useState("");

  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data || [];

  const { data: resData, isLoading } = useListReservations({
    branch_id: branchId || undefined,
    date:      date     || undefined,
    status:    serverStatus || undefined,
  });
  const reservations = (resData?.data || []) as unknown as Record<string, unknown>[];

  const TAB_STYLE = (active: boolean) => ({
    padding: "10px 20px", background: "none", border: "none",
    borderBottom: `2px solid ${active ? "#D1AE38" : "transparent"}`,
    marginBottom: -1, fontSize: 13,
    fontWeight: active ? 700 : 400,
    color: active ? "#D1AE38" : "#6b7280",
    cursor: "pointer", transition: "all 0.15s",
    display: "flex", alignItems: "center", gap: 6,
  } as React.CSSProperties);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Tab bar ── */}
      <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button style={TAB_STYLE(activeTab === "today")} onClick={() => setActiveTab("today")}>
          <CalendarDays className="w-3.5 h-3.5" /> Today's Reservations
        </button>
        <button style={TAB_STYLE(activeTab === "history")} onClick={() => setActiveTab("history")}>
          <History className="w-3.5 h-3.5" /> Reservation History
        </button>
      </div>

      {/* ─── TODAY TAB ─── */}
      {activeTab === "today" && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["tentative", "confirmed", "checked_in", "checked_out"].map((s) => {
              const count = (resData?.data || []).filter((r) => r.status === s).length;
              return (
                <Card key={s} className="p-4 bg-black/40 text-center">
                  <p className={`text-2xl font-display font-bold ${STATUS_TEXT[s] || ""}`}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{s.replace("_", " ")}</p>
                </Card>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={branchId || "__all__"} onValueChange={v => setBranchId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-48 bg-black/30">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DateInput value={date} onChange={e => setDate(e.target.value)} wrapperClassName="w-44" />
            <Select value={serverStatus || "__all__"} onValueChange={v => setServerStatus(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-44 bg-black/30">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                {RESERVATION_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <ListPageWrapper
            title="Reservations"
            subtitle="Manage bookings and guest lifecycle"
            data={reservations}
            columns={RESERVATION_COLUMNS}
            cardRenderer={(row) => <ReservationCard reservation={row as unknown as Reservation} />}
            filterKey="status"
            filterLabel="Status"
            filterOptions={RESERVATION_STATUS_OPTIONS}
            searchKeys={["reservationNo", "customerName", "customerPhone"]}
            searchPlaceholder="Search reservations..."
            isLoading={isLoading}
            onRowClick={(row) => navigate(`/reservations/${(row as { id: string }).id}`)}
            onAddNew={() => navigate("/reservations/new")}
            addNewLabel="New Booking"
            emptyIcon={<CalendarDays className="w-10 h-10" />}
            emptyMessage="No reservations found for the selected filters"
          />
        </>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === "history" && <HistoryTab branches={branches} />}
    </div>
  );
}
