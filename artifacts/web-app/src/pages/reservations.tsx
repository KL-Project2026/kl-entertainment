import { useState } from "react";
import { useLocation } from "wouter";
import { useListBranches, useListReservations, useConfirmReservation, useCheckInReservation, useCheckOutReservation, useCancelReservation } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Card, Button, Badge, Input } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, CalendarDays, Users, Clock, DoorOpen, ShoppingCart, X, LayoutGrid, Table2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getListReservationsQueryKey } from "@workspace/api-client-react";
import type { Reservation } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  tentative:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled:   "bg-red-500/15 text-red-400 border-red-500/30",
  no_show:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

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
          <Input
            placeholder="Cancellation reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Keep</Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="flex-1"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  const [, navigate] = useLocation();
  const [showCancel, setShowCancel] = useState(false);
  const queryClient = useQueryClient();
  const confirmMut = useConfirmReservation();
  const checkInMut = useCheckInReservation();
  const checkOutMut = useCheckOutReservation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });

  const handleConfirm = async () => {
    await confirmMut.mutateAsync({ id: reservation.id });
    invalidate();
  };

  const handleCheckIn = async () => {
    await checkInMut.mutateAsync({ id: reservation.id });
    invalidate();
  };

  const handleCheckOut = async () => {
    await checkOutMut.mutateAsync({ id: reservation.id });
    invalidate();
  };

  const startTime = new Date(reservation.startTime);
  const isBusy = confirmMut.isPending || checkInMut.isPending || checkOutMut.isPending;

  return (
    <>
      <Card className="p-5 flex flex-col gap-4 hover:border-primary/20 transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-lg font-bold">{reservation.reservationNo}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[reservation.status] || ''}`}>
                {reservation.status.replace("_", " ")}
              </span>
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
            <Button size="sm" onClick={handleConfirm} disabled={isBusy} className="flex-1 gap-1.5">
              Confirm
            </Button>
          )}
          {reservation.status === "confirmed" && (
            <Button size="sm" onClick={handleCheckIn} disabled={isBusy} className="flex-1 gap-1.5">
              <DoorOpen className="w-3.5 h-3.5" /> Check In
            </Button>
          )}
          {(reservation.status === "checked_in" || reservation.status === "extended") && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/pos?reservationId=${reservation.id}`)}
                className="flex-1 gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> POS
              </Button>
              <Button size="sm" onClick={handleCheckOut} disabled={isBusy} className="flex-1 gap-1.5">
                Check Out
              </Button>
            </>
          )}
          {["tentative", "confirmed"].includes(reservation.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCancel(true)}
              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </Card>

      {showCancel && (
        <CancelModal reservation={reservation} onClose={() => setShowCancel(false)} />
      )}
    </>
  );
}

export default function Reservations() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const [branchId, setBranchId] = useState(user?.branchId || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data || [];

  const { data: resData, isLoading } = useListReservations({
    branch_id: branchId || undefined,
    date: date || undefined,
    status: status || undefined,
  });

  const reservations = (resData?.data || []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.reservationNo.toLowerCase().includes(s) ||
      (r.customerName || "").toLowerCase().includes(s) ||
      (r.customerPhone || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Reservations</h2>
          <p className="text-muted-foreground text-sm">Manage bookings and guest lifecycle</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("card")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${viewMode === "card" ? "bg-primary text-primary-foreground" : "hover:bg-white/5 text-muted-foreground"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-white/5 text-muted-foreground"}`}
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <Button onClick={() => navigate("/reservations/new")} className="gap-2">
            <Plus className="w-4 h-4" /> New Booking
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-4 bg-black/40 border-white/5">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Input
            placeholder="Search reservations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <Select value={branchId || "__all__"} onValueChange={(v) => setBranchId(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48 bg-black/30">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        />
        <Select value={status || "__all__"} onValueChange={(v) => setStatus(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44 bg-black/30">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {["tentative","confirmed","checked_in","extended","checked_out","cancelled","no_show"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {["tentative","confirmed","checked_in","checked_out"].map((s) => {
          const count = (resData?.data || []).filter(r => r.status === s).length;
          return (
            <Card key={s} className="p-4 bg-black/40 text-center">
              <p className={`text-2xl font-display font-bold ${STATUS_COLORS[s]?.split(" ")[1] || ""}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{s.replace("_", " ")}</p>
            </Card>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : reservations.length === 0 ? (
        <Card className="p-12 text-center bg-black/40">
          <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No reservations found for the selected filters</p>
          <Button variant="outline" onClick={() => navigate("/reservations/new")} className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Create First Booking
          </Button>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reservations.map((r) => <ReservationCard key={r.id} reservation={r} />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Booking #</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Deposit</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const start = new Date(r.startTime);
                return (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.reservationNo}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${STATUS_COLORS[r.status] ?? ""}`}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.customerName || "Walk-in"}</p>
                      {r.customerPhone && <p className="text-xs text-muted-foreground">{r.customerPhone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p>{r.roomName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.roomType}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(r.startTime)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">{r.guestCount}</td>
                    <td className="px-4 py-3">
                      {r.depositPaid ? (
                        <span className="text-emerald-400">RM {parseFloat(r.depositAmount || "0").toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
