import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Users, Clock, DoorOpen,
  ShoppingCart, X, CheckCircle, LogIn, LogOut, User,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  tentative:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled:   "bg-red-500/15 text-red-400 border-red-500/30",
  no_show:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function DetailRow({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reservation", id],
    queryFn: async () => {
      const r = await fetch(`/api/reservations/${id}`);
      if (!r.ok) throw new Error("Not found");
      const j = await r.json();
      return j.data;
    },
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["reservation", id] });

  const confirmMut = useMutation({
    mutationFn: () => fetch(`/api/reservations/${id}/confirm`, { method: "PUT" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const checkInMut = useMutation({
    mutationFn: () => fetch(`/api/reservations/${id}/check-in`, { method: "PUT" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const checkOutMut = useMutation({
    mutationFn: () => fetch(`/api/reservations/${id}/check-out`, { method: "PUT" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const cancelMut = useMutation({
    mutationFn: () =>
      fetch(`/api/reservations/${id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setShowCancel(false); },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-white/5 rounded" />
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>Reservation not found.</p>
          <Button variant="ghost" onClick={() => navigate("/reservations")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Reservations
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const res = data;
  const isBusy = confirmMut.isPending || checkInMut.isPending || checkOutMut.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/reservations")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold">{res.reservationNo}</h1>
                <Badge className={`border text-xs ${STATUS_COLORS[res.status] ?? ""}`}>
                  {res.status?.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Created {formatDate(res.createdAt)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap justify-end">
            {res.status === "tentative" && (
              <Button size="sm" onClick={() => confirmMut.mutate()} disabled={isBusy} className="gap-1.5">
                <CheckCircle className="w-4 h-4" /> Confirm
              </Button>
            )}
            {res.status === "confirmed" && (
              <Button size="sm" onClick={() => checkInMut.mutate()} disabled={isBusy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <LogIn className="w-4 h-4" /> Check In
              </Button>
            )}
            {res.status === "checked_in" && (
              <>
                <Button size="sm" variant="outline" onClick={() => navigate(`/pos?reservationId=${id}`)} className="gap-1.5">
                  <ShoppingCart className="w-4 h-4" /> Open POS
                </Button>
                <Button size="sm" onClick={() => checkOutMut.mutate()} disabled={isBusy} className="gap-1.5">
                  <LogOut className="w-4 h-4" /> Check Out
                </Button>
              </>
            )}
            {["tentative", "confirmed"].includes(res.status) && (
              <Button size="sm" variant="outline" onClick={() => setShowCancel(true)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                <X className="w-4 h-4" /> Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Booking Info */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Booking Info
            </h3>
            <DetailRow label="Room" value={res.roomName} />
            <DetailRow label="Room Type" value={res.roomType?.replace(/_/g, " ")} />
            <DetailRow label="Date" value={formatDate(res.startTime)} />
            <DetailRow label="Check-in Time" value={res.startTime ? new Date(res.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null} />
            <DetailRow label="End Time" value={res.endTime ? new Date(res.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null} />
            <DetailRow label="Guest Count" value={res.guestCount} />
            <DetailRow label="Booking Channel" value={res.bookingChannel} />
            <DetailRow label="Special Requests" value={res.specialRequests} />
          </Card>

          {/* Customer Info */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Customer
            </h3>
            <DetailRow label="Name" value={res.customerName || "Walk-in"} />
            <DetailRow label="Phone" value={res.customerPhone} />
            <DetailRow label="Customer ID" value={res.customerId} />

            <h3 className="font-display font-semibold mt-6 mb-4 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-primary" /> Deposit
            </h3>
            <DetailRow
              label="Deposit Paid"
              value={res.depositPaid ? formatCurrency(parseFloat(res.depositAmount || "0")) : "Not Paid"}
            />
            <DetailRow label="Payment Method" value={res.depositPaymentMethod} />
            {res.checkedInAt && <DetailRow label="Checked In" value={new Date(res.checkedInAt).toLocaleString()} />}
            {res.checkedOutAt && <DetailRow label="Checked Out" value={new Date(res.checkedOutAt).toLocaleString()} />}
            {res.cancelledAt && <DetailRow label="Cancelled" value={new Date(res.cancelledAt).toLocaleString()} />}
            {res.cancellationReason && <DetailRow label="Cancel Reason" value={res.cancellationReason} />}
          </Card>
        </div>

        {/* Hostesses */}
        {res.hostesses && res.hostesses.length > 0 && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Assigned Hostesses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {res.hostesses.map((h: Record<string, string>) => (
                <div key={h.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {h.fullName?.charAt(0) ?? "H"}
                  </div>
                  <span className="text-sm font-medium">{h.fullName}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-lg font-bold">Cancel Reservation</h3>
              <button onClick={() => setShowCancel(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Cancel <span className="text-foreground font-semibold">{res.reservationNo}</span>?
            </p>
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Reason (optional)</label>
              <Input placeholder="Cancellation reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowCancel(false)} className="flex-1">Keep</Button>
              <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="flex-1">
                {cancelMut.isPending ? "Cancelling…" : "Confirm Cancel"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
