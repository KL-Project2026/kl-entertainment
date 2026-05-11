import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  useListBranches,
  useGetReservationAvailability,
  useListAvailableHostesses,
  useCreateReservation,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Users, Clock, DoorOpen, User, Phone, CalendarDays } from "lucide-react";
import type { Room, StaffAvailabilityItem } from "@workspace/api-client-react";

const STEPS = ["Guest Details", "Select Room", "Assign Hostesses", "Confirm"];

interface FormData {
  branchId: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationDate: string;
  startTime: string;
  durationHours: number;
  bookingChannel: string;
  specialRequests: string;
  depositAmount: number;
  depositPaid: boolean;
  depositMethod: string;
  roomId: string;
  hostessIds: string[];
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              i < currentStep ? "bg-primary text-primary-foreground" :
              i === currentStep ? "bg-primary/20 border-2 border-primary text-primary" :
              "bg-white/5 border border-white/10 text-muted-foreground"
            }`}>
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i === currentStep ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-16 h-px mx-2 mb-4 ${i < currentStep ? "bg-primary" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Step1({ form, onChange }: { form: FormData; onChange: (patch: Partial<FormData>) => void }) {
  const { data: branchesData } = useListBranches();
  const branches = branchesData?.data || [];
  const { user } = useAuthStore();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Branch *</label>
          <Select value={form.branchId} onValueChange={(v) => onChange({ branchId: v })}>
            <SelectTrigger className="bg-black/30">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.booking_channel")}</label>
          <Select value={form.bookingChannel} onValueChange={(v) => onChange({ bookingChannel: v })}>
            <SelectTrigger className="bg-black/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["walk_in","phone","whatsapp","app","agent","online"].map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.customer_name")}</label>
          <Input
            placeholder={t("pages.booking_wizard.guest_name_placeholder")}
            value={form.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
            icon={<User className="w-4 h-4" />}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("common.phone")}</label>
          <Input
            placeholder="+60 1X-XXXXXXXX"
            value={form.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
            icon={<Phone className="w-4 h-4" />}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.date")} *</label>
          <input
            type="date"
            value={form.reservationDate}
            onChange={(e) => onChange({ reservationDate: e.target.value })}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.start_time")} *</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.guest_count")} *</label>
          <Input
            type="number"
            min={1}
            max={50}
            value={form.guestCount}
            onChange={(e) => onChange({ guestCount: parseInt(e.target.value) || 1 })}
            icon={<Users className="w-4 h-4" />}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.duration_hours")} *</label>
          <Input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={form.durationHours}
            onChange={(e) => onChange({ durationHours: parseFloat(e.target.value) || 2 })}
            icon={<Clock className="w-4 h-4" />}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.special_requests")}</label>
        <textarea
          placeholder={t("pages.booking_wizard.special_requests_placeholder")}
          value={form.specialRequests}
          onChange={(e) => onChange({ specialRequests: e.target.value })}
          rows={3}
          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
        <div className="space-y-1.5 col-span-3 sm:col-span-1">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.deposit_amount")}</label>
          <Input
            type="number"
            min={0}
            value={form.depositAmount}
            onChange={(e) => onChange({ depositAmount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">{t("pages.booking_wizard.deposit_paid")}</label>
          <div className="flex items-center h-10 gap-3">
            <button
              onClick={() => onChange({ depositPaid: !form.depositPaid })}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.depositPaid ? "bg-primary" : "bg-white/10"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.depositPaid ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className="text-sm">{form.depositPaid ? "Yes" : "No"}</span>
          </div>
        </div>
        {form.depositPaid && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Method</label>
            <Select value={form.depositMethod} onValueChange={(v) => onChange({ depositMethod: v })}>
              <SelectTrigger className="bg-black/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["cash","card","bank_transfer","ewallet"].map(m => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace("_"," ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

function Step2({ form, onChange }: { form: FormData; onChange: (patch: Partial<FormData>) => void }) {
  const startDateTime = form.reservationDate && form.startTime
    ? `${form.reservationDate}T${form.startTime}:00`
    : undefined;

  const { data: availData, isLoading } = useGetReservationAvailability({
    branch_id: form.branchId,
    date: form.reservationDate,
    duration_hours: form.durationHours,
  }, { query: { enabled: !!form.branchId && !!form.reservationDate } });

  const rooms = (availData?.data || []) as Room[];

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}</div>;
  }

  if (rooms.length === 0) {
    return (
      <Card className="p-12 text-center bg-black/40">
        <DoorOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">No rooms available for the selected time slot</p>
        <p className="text-sm text-muted-foreground/60 mt-1">{t("pages.booking_wizard.try_different")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{rooms.length} room{rooms.length !== 1 ? "s" : ""} available — click to select</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map((room) => {
          const isSelected = form.roomId === room.id;
          return (
            <Card
              key={room.id}
              onClick={() => onChange({ roomId: isSelected ? "" : room.id })}
              className={`p-5 cursor-pointer transition-all ${
                isSelected ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(212,175,55,0.15)]" : "hover:border-white/20"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-display text-lg font-bold">{room.name}</h4>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{room.roomType?.replace("_"," ")}</p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {room.capacity ?? "?"} cap.</span>
                {room.hourlyRate && <span className="text-primary font-semibold">MYR {Number(room.hourlyRate).toFixed(0)}/hr</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Step3({ form, onChange }: { form: FormData; onChange: (patch: Partial<FormData>) => void }) {
  const { data: hostessData, isLoading } = useListAvailableHostesses({
    branch_id: form.branchId,
    date: form.reservationDate,
    start_time: form.startTime,
  }, { query: { enabled: !!form.branchId } });

  const hostesses = (hostessData?.data || []) as StaffAvailabilityItem[];
  const selected = form.hostessIds;

  const toggle = (id: string) => {
    onChange({ hostessIds: selected.includes(id) ? selected.filter(h => h !== id) : [...selected, id] });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("pages.booking_wizard.select_hostesses")}</p>
      {hostesses.length === 0 ? (
        <Card className="p-8 text-center bg-black/40">
          <p className="text-muted-foreground">{t("pages.booking_wizard.no_hostesses_slot")}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">You can proceed without assigning hostesses</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hostesses.map((h) => {
            const isSelected = selected.includes(h.id);
            return (
              <Card
                key={h.id}
                onClick={() => toggle(h.id)}
                className={`p-4 cursor-pointer transition-all flex items-center gap-4 ${
                  isSelected ? "border-primary/60 bg-primary/10" : "hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{h.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{h.role.replace("_"," ")}</p>
                </div>
                {h.rating && <span className="text-xs text-primary">★ {h.rating}</span>}
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step4({ form }: { form: FormData }) {
  const { data: branchesData } = useListBranches();
  const branch = (branchesData?.data || []).find(b => b.id === form.branchId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review your booking details before confirming</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-black/40 space-y-3">
          <h4 className="font-semibold text-sm text-primary uppercase tracking-wider">{t("pages.booking_wizard.guest")}</h4>
          <div className="space-y-2 text-sm">
            <Row label="Name" value={form.customerName || "Walk-in"} />
            <Row label="Phone" value={form.customerPhone || "—"} />
            <Row label="Guests" value={`${form.guestCount} people`} />
          </div>
        </Card>
        <Card className="p-4 bg-black/40 space-y-3">
          <h4 className="font-semibold text-sm text-primary uppercase tracking-wider">{t("pages.booking_wizard.schedule")}</h4>
          <div className="space-y-2 text-sm">
            <Row label="Branch" value={branch?.name || "—"} />
            <Row label="Date" value={form.reservationDate} />
            <Row label="Time" value={`${form.startTime} · ${form.durationHours}h`} />
            <Row label="Channel" value={form.bookingChannel.replace("_"," ")} />
          </div>
        </Card>
        {form.depositAmount > 0 && (
          <Card className="p-4 bg-black/40 space-y-3">
            <h4 className="font-semibold text-sm text-primary uppercase tracking-wider">{t("pages.booking_wizard.deposit")}</h4>
            <div className="space-y-2 text-sm">
              <Row label="Amount" value={`MYR ${form.depositAmount.toFixed(2)}`} />
              <Row label="Paid" value={form.depositPaid ? "Yes" : "No"} />
              {form.depositPaid && <Row label="Method" value={form.depositMethod.replace("_"," ")} />}
            </div>
          </Card>
        )}
        {form.specialRequests && (
          <Card className="p-4 bg-black/40 col-span-full">
            <h4 className="font-semibold text-sm text-primary uppercase tracking-wider mb-2">Special Requests</h4>
            <p className="text-sm text-muted-foreground">{form.specialRequests}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

export default function BookingWizard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const createMutation = useCreateReservation();

  const today = new Date().toISOString().slice(0, 10);
  const defaultTime = "20:00";

  const [form, setForm] = useState<FormData>({
    branchId: user?.branchId || "",
    customerName: "",
    customerPhone: "",
    guestCount: 2,
    reservationDate: today,
    startTime: defaultTime,
    durationHours: 2,
    bookingChannel: "walk_in",
    specialRequests: "",
    depositAmount: 0,
    depositPaid: false,
    depositMethod: "cash",
    roomId: "",
    hostessIds: [],
  });

  const patch = (p: Partial<FormData>) => setForm(f => ({ ...f, ...p }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.branchId) return "Please select a branch";
      if (!form.reservationDate) return "Please select a date";
      if (!form.startTime) return "Please set a start time";
      if (form.guestCount < 1) return "At least 1 guest required";
    }
    return "";
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    try {
      const startDateTime = `${form.reservationDate}T${form.startTime}:00`;
      const endMs = new Date(startDateTime).getTime() + form.durationHours * 3600 * 1000;
      const endDateTime = new Date(endMs).toISOString();

      await createMutation.mutateAsync({
        data: {
          branchId: form.branchId,
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          guestCount: form.guestCount,
          reservationDate: form.reservationDate,
          startTime: startDateTime,
          endTime: endDateTime,
          durationHours: form.durationHours,
          roomId: form.roomId || undefined,
          bookingChannel: form.bookingChannel,
          specialRequests: form.specialRequests || undefined,
          depositAmount: form.depositAmount,
          depositPaid: form.depositPaid,
          depositMethod: form.depositPaid ? form.depositMethod : undefined,
          hostessIds: form.hostessIds.length > 0 ? form.hostessIds : undefined,
        },
      });
      navigate("/reservations");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create reservation");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => step === 0 ? navigate("/reservations") : setStep(s => s - 1)}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold">{t("pages.booking_wizard.new_booking")}</h2>
          <p className="text-muted-foreground text-sm">Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>

      <StepIndicator currentStep={step} />

      <Card className="p-6 bg-black/40 border-white/5">
        <h3 className="font-display text-lg font-semibold mb-6">{STEPS[step]}</h3>
        {step === 0 && <Step1 form={form} onChange={patch} />}
        {step === 1 && <Step2 form={form} onChange={patch} />}
        {step === 2 && <Step3 form={form} onChange={patch} />}
        {step === 3 && <Step4 form={form} />}
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} className="flex-1 gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex-1 gap-2"
          >
            {createMutation.isPending ? "Creating..." : <><Check className="w-4 h-4" /> Confirm Booking</>}
          </Button>
        )}
      </div>
    </div>
  );
}
