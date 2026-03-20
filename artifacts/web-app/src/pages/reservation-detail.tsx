import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Users, DoorOpen, ShoppingCart,
  X, CheckCircle, LogIn, LogOut, Edit2, Save, Clock, MapPin, Hash,
  Phone, CreditCard, MessageSquare, BadgeCheck, User,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FolioView } from "@/components/shared/FolioView";

// ─── Status configuration ─────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  tentative:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled:   "bg-red-500/15 text-red-400 border-red-500/30",
  no_show:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const STATUS_STEP: Record<string, number> = {
  tentative: 0, confirmed: 1, checked_in: 2, extended: 2, checked_out: 3, cancelled: -1, no_show: -1,
};

const TIMELINE_STEPS = [
  { key: "tentative",   label: "Tentative" },
  { key: "confirmed",   label: "Confirmed" },
  { key: "checked_in",  label: "Checked In" },
  { key: "checked_out", label: "Checked Out" },
];

// ─── Sub-components ────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, accent }: {
  icon?: React.ElementType;
  label: string;
  value?: string | null | number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <span className="text-sm text-muted-foreground min-w-[100px] shrink-0">{label}</span>
      <span className={`text-sm font-medium ml-auto text-right ${accent ? "text-primary font-bold" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const step = STATUS_STEP[status] ?? 0;
  const isCancelled = status === "cancelled" || status === "no_show";

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-5 bg-red-500/10 rounded-xl border border-red-500/20">
        <X className="w-4 h-4 text-red-400" />
        <span className="text-sm font-medium text-red-400 capitalize">{status.replace("_", " ")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {TIMELINE_STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.key} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 transition-colors ${
                active
                  ? "bg-primary border-primary text-black"
                  : done
                  ? "bg-primary/30 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-muted-foreground"
              }`}>
                {done ? <BadgeCheck className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-primary/60" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-px mb-4 ${done ? "bg-primary/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
interface EditForm {
  customerName: string;
  customerPhone: string;
  guestCount: string;
  bookingChannel: string;
  specialRequests: string;
  depositAmount: string;
  depositPaid: string;
  depositMethod: string;
}

function EditModal({
  res,
  onClose,
  onSave,
  isPending,
}: {
  res: Record<string, unknown>;
  onClose: () => void;
  onSave: (data: EditForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<EditForm>({
    customerName:    String(res.customerName   ?? ""),
    customerPhone:   String(res.customerPhone  ?? ""),
    guestCount:      String(res.guestCount     ?? ""),
    bookingChannel:  String(res.bookingChannel ?? ""),
    specialRequests: String(res.specialRequests ?? ""),
    depositAmount:   String(res.depositAmount  ?? "0"),
    depositPaid:     res.depositPaid ? "true" : "false",
    depositMethod:   String(res.depositMethod  ?? ""),
  });

  const set = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-base">Edit Reservation</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Customer */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
                <Input className="bg-black/30" placeholder="Walk-in" value={form.customerName} onChange={set("customerName")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Phone</label>
                <Input className="bg-black/30" placeholder="+60..." value={form.customerPhone} onChange={set("customerPhone")} />
              </div>
            </div>
          </div>

          {/* Booking */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Booking</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Guest Count</label>
                <Input className="bg-black/30" type="number" min="1" value={form.guestCount} onChange={set("guestCount")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Booking Channel</label>
                <Select value={form.bookingChannel} onValueChange={v => setForm(f => ({ ...f, bookingChannel: v }))}>
                  <SelectTrigger className="bg-black/30"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground block mb-1.5">Special Requests</label>
              <textarea
                className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[72px]"
                placeholder="Any special requests..."
                value={form.specialRequests}
                onChange={set("specialRequests")}
              />
            </div>
          </div>

          {/* Deposit */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deposit</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Amount (MYR)</label>
                <Input className="bg-black/30" type="number" min="0" step="0.01" value={form.depositAmount} onChange={set("depositAmount")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Paid</label>
                <Select value={form.depositPaid} onValueChange={v => setForm(f => ({ ...f, depositPaid: v }))}>
                  <SelectTrigger className="bg-black/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Paid</SelectItem>
                    <SelectItem value="false">Not Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Method</label>
                <Select value={form.depositMethod || "__none__"} onValueChange={v => setForm(f => ({ ...f, depositMethod: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="bg-black/30"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isPending} className="flex-1 gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reservation", id],
    queryFn: async () => {
      const r = await fetch(`/api/reservations/${id}`);
      if (!r.ok) throw new Error("Not found");
      return (await r.json()).data;
    },
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservation", id] });
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const updateMut = useMutation({
    mutationFn: (body: EditForm) =>
      fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:    body.customerName    || null,
          customerPhone:   body.customerPhone   || null,
          guestCount:      Number(body.guestCount) || null,
          bookingChannel:  body.bookingChannel  || null,
          specialRequests: body.specialRequests || null,
          depositAmount:   Number(body.depositAmount) || null,
          depositPaid:     body.depositPaid === "true",
          depositMethod:   body.depositMethod   || null,
        }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setShowEdit(false); },
  });

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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-5 animate-pulse">
          <div className="h-10 w-64 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="grid grid-cols-2 gap-5">
            <div className="h-64 bg-white/5 rounded-xl" />
            <div className="h-64 bg-white/5 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <p className="text-lg">Reservation not found.</p>
          <Button variant="ghost" onClick={() => navigate("/reservations")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Reservations
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const res = data as Record<string, unknown>;
  const isBusy = confirmMut.isPending || checkInMut.isPending || checkOutMut.isPending;
  const status = String(res.status ?? "");
  const canEdit = !["checked_out", "cancelled", "no_show"].includes(status);

  const fmtTime = (iso: unknown) =>
    iso ? new Date(String(iso)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/reservations")}
              className="mt-0.5 p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-display font-bold tracking-tight">{String(res.reservationNo ?? "")}</h1>
                <Badge className={`border px-3 py-1 text-xs font-medium capitalize ${STATUS_COLORS[status] ?? ""}`}>
                  {status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created {formatDate(String(res.createdAt ?? ""))}
                {res.confirmedAt && (
                  <span className="ml-3 text-blue-400/70">· Confirmed {formatDate(String(res.confirmedAt))}</span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} className="gap-1.5 border-white/15 hover:bg-white/10">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
            {status === "tentative" && (
              <Button size="sm" onClick={() => confirmMut.mutate()} disabled={isBusy} className="gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Confirm
              </Button>
            )}
            {status === "confirmed" && (
              <Button size="sm" onClick={() => checkInMut.mutate()} disabled={isBusy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                <LogIn className="w-3.5 h-3.5" /> Check In
              </Button>
            )}
            {status === "checked_in" && (
              <>
                <Button size="sm" variant="outline" onClick={() => navigate(`/pos?reservationId=${String(id)}`)} className="gap-1.5 border-white/15">
                  <ShoppingCart className="w-3.5 h-3.5" /> POS
                </Button>
                <Button size="sm" onClick={() => checkOutMut.mutate()} disabled={isBusy} className="gap-1.5">
                  <LogOut className="w-3.5 h-3.5" /> Check Out
                </Button>
              </>
            )}
            {["tentative", "confirmed"].includes(status) && (
              <Button
                size="sm" variant="outline"
                onClick={() => setShowCancel(true)}
                className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* ── Status timeline ── */}
        <Card className="px-6 py-4 bg-black/40 border-white/5">
          <StatusTimeline status={status} />
        </Card>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", flexWrap: "wrap" }}>
          {([ ["info", "예약 정보"], ["folio", "Folio (실시간)"] ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: "10px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === key ? "#D1AE38" : "transparent"}`,
              marginBottom: -2, fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? "#D1AE38" : "#6b7280",
              cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {activeTab === "info" && (<>
        {/* ── Info grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Booking Info */}
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm">Booking Info</span>
            </div>
            <div className="px-5 py-3">
              <InfoRow icon={MapPin}  label="Room"         value={String(res.roomName ?? "—")} />
              <InfoRow icon={Hash}    label="Room Type"    value={res.roomType ? String(res.roomType).replace(/_/g, " ") : null} />
              <InfoRow icon={CalendarDays} label="Date"   value={formatDate(String(res.startTime ?? ""))} />
              <InfoRow icon={Clock}   label="Start Time"  value={fmtTime(res.startTime)} />
              <InfoRow icon={Clock}   label="End Time"    value={fmtTime(res.endTime)} />
              {res.durationHours && (
                <InfoRow icon={Clock} label="Duration"    value={`${res.durationHours}h`} />
              )}
              <InfoRow icon={Users}   label="Guests"      value={String(res.guestCount ?? "—")} />
              <InfoRow icon={MessageSquare} label="Channel" value={String(res.bookingChannel ?? "—")} />
              {res.specialRequests && (
                <InfoRow icon={MessageSquare} label="Requests" value={String(res.specialRequests)} />
              )}
            </div>
          </Card>

          {/* Customer + Deposit */}
          <div className="flex flex-col gap-5">
            <Card className="bg-black/40 border-white/5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm">Customer</span>
              </div>
              <div className="px-5 py-3">
                <InfoRow icon={User}  label="Name"  value={String(res.customerName || "Walk-in")} />
                <InfoRow icon={Phone} label="Phone" value={String(res.customerPhone ?? "—")} />
              </div>
            </Card>

            <Card className="bg-black/40 border-white/5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm">Deposit</span>
              </div>
              <div className="px-5 py-3">
                <InfoRow
                  icon={CreditCard}
                  label="Amount"
                  value={formatCurrency(Number(res.depositAmount ?? 0))}
                  accent={Boolean(res.depositPaid) && Number(res.depositAmount) > 0}
                />
                <InfoRow
                  label="Status"
                  value={res.depositPaid ? "✓ Paid" : "Not Paid"}
                />
                {res.depositMethod && (
                  <InfoRow label="Method" value={String(res.depositMethod)} />
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Timeline events ── */}
        {(res.checkedInAt || res.checkedOutAt || res.cancelledAt) && (
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm">Activity Log</span>
            </div>
            <div className="px-5 py-3 space-y-2">
              {res.confirmedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-muted-foreground">Confirmed</span>
                  <span className="ml-auto text-xs">{new Date(String(res.confirmedAt)).toLocaleString()}</span>
                </div>
              )}
              {res.checkedInAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-muted-foreground">Checked In</span>
                  <span className="ml-auto text-xs">{new Date(String(res.checkedInAt)).toLocaleString()}</span>
                </div>
              )}
              {res.checkedOutAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                  <span className="text-muted-foreground">Checked Out</span>
                  <span className="ml-auto text-xs">{new Date(String(res.checkedOutAt)).toLocaleString()}</span>
                </div>
              )}
              {res.cancelledAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <span className="text-muted-foreground">Cancelled</span>
                  <span className="ml-auto text-xs">{new Date(String(res.cancelledAt)).toLocaleString()}</span>
                </div>
              )}
              {res.cancellationReason && (
                <p className="text-xs text-muted-foreground pl-5 italic">"{String(res.cancellationReason)}"</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Hostesses ── */}
        {Array.isArray(res.hostesses) && res.hostesses.length > 0 && (
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-display font-semibold text-sm">
                Assigned Hostesses ({res.hostesses.length})
              </span>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(res.hostesses as Record<string, string>[]).map((h) => (
                <div key={h.id} className="flex items-center gap-3 bg-white/5 hover:bg-white/8 transition-colors rounded-xl p-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {h.fullName?.charAt(0) ?? "H"}
                  </div>
                  <span className="text-sm font-medium truncate">{h.fullName}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        </>)}

        {activeTab === "folio" && (
          <FolioView
            reservationId={id!}
            currency="MYR"
            isLive={status === "checked_in"}
          />
        )}
      </div>

      {/* ── Edit Modal ── */}
      {showEdit && (
        <EditModal
          res={res}
          onClose={() => setShowEdit(false)}
          onSave={(form) => updateMut.mutate(form)}
          isPending={updateMut.isPending}
        />
      )}

      {/* ── Cancel Modal ── */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="font-display font-bold">Cancel Reservation</h3>
              <button onClick={() => setShowCancel(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                This will cancel{" "}
                <span className="text-foreground font-semibold">{String(res.reservationNo ?? "")}</span>.
                This action cannot be undone.
              </p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Reason (optional)</label>
                <Input
                  className="bg-black/30"
                  placeholder="Cancellation reason..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex gap-3">
              <Button variant="ghost" onClick={() => setShowCancel(false)} className="flex-1">Keep</Button>
              <Button
                variant="destructive"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                className="flex-1"
              >
                {cancelMut.isPending ? "Cancelling…" : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
