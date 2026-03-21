import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Star, Edit, ToggleLeft, ToggleRight, UserPlus, CalendarPlus, X, Clock, MapPin, Phone, User, CalendarDays, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────
interface HostessProfile {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  branchId: string;
  branchName: string;
  allowedBranchIds: string[];
  nationality: string | null;
  nationalityCode: string | null;
  languagesSpoken: string[];
  status: string;
  availableToday: boolean;
  isFeatured: boolean;
  primaryPhoto: string | null;
  photoCount: number;
  serviceCount: number;
  minServicePrice: number | null;
  age: number | null;
  agencyId: string | null;
  agentName: string | null;
  agencyCommissionRate: number | null;
  agencyCommissionType: string | null;
}

interface Branch { id: string; name: string; internalCode: string; }

interface ScheduleDay { dayOfWeek: number; shiftStart: string; shiftEnd: string; isOvernight: boolean; }
interface ScheduleData {
  id: string; staffName: string; status: string; availableToday: boolean;
  hourlyRate: number; nationalityCode: string | null;
  weeklySchedule: ScheduleDay[];
  allowedBranches: { id: string; name: string; internal_code: string }[];
  currentlyBusy: { id: string; reservation_no: string } | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const BOOKING_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
  { value: "walk_in", label: "Walk-in" },
  { value: "agent", label: "Agent" },
  { value: "online", label: "Online" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────
const NATIONALITY_FLAGS: Record<string, string> = {
  MY: "🇲🇾", TH: "🇹🇭", VN: "🇻🇳", PH: "🇵🇭", ID: "🇮🇩",
  KR: "🇰🇷", JP: "🇯🇵", CN: "🇨🇳", SG: "🇸🇬", BD: "🇧🇩", IN: "🇮🇳",
};

const LANG_LABELS: Record<string, string> = {
  en: "EN", "zh-Hans": "中文", ko: "한국어", th: "ไทย",
  ms: "BM", vi: "Việt", id: "Indo", tl: "Fil", ta: "தமிழ்", bn: "বাং",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-300 border-green-500/30",
  inactive: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  on_leave: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
};

// ─── BookModal ────────────────────────────────────────────────────
function BookModal({ profile, onClose }: { profile: HostessProfile; onClose: () => void }) {
  const { token } = useAuthStore();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};
  const [mounted, setMounted] = useState(false);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<"schedule" | "book">("schedule");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("21:00");
  const [durationHours, setDurationHours] = useState("2");
  const [isOutcall, setIsOutcall] = useState(false);
  const [branchId, setBranchId] = useState(profile.branchId);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [channel, setChannel] = useState<string>("whatsapp");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Fetch schedule
  const { data: schedData, isLoading: schedLoading } = useQuery<ScheduleData>({
    queryKey: ["hostess-schedule", profile.id],
    queryFn: async () => {
      const r = await fetch(`/api/hostess-profiles/${profile.id}/schedule`, { headers: authH });
      if (!r.ok) throw new Error("Failed to load schedule");
      const j = await r.json() as { data: ScheduleData };
      return j.data;
    },
    staleTime: 60_000,
  });

  // Set default branch from schedule data
  useEffect(() => {
    if (schedData?.allowedBranches?.length && !schedData.allowedBranches.find(b => b.id === branchId)) {
      setBranchId(schedData.allowedBranches[0].id);
    }
  }, [schedData?.allowedBranches?.length]);

  const handleBook = async () => {
    if (!date || !startTime) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/hostess-profiles/${profile.id}/quick-book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          branchId, reservationDate: date, startTime, durationHours: Number(durationHours),
          isOutcall, customerName: customerName || null, customerPhone: customerPhone || null,
          specialRequests: specialRequests || null, bookingChannel: channel,
        }),
      });
      const body = await resp.json() as { success?: boolean; data?: { reservationId: string; reservationNo: string; hostessName: string }; error?: string; message?: string };
      if (!resp.ok || !body.success) {
        toast({ title: "Booking Failed", description: body.message ?? body.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      toast({
        title: "Booking Confirmed",
        description: `${body.data!.reservationNo} — ${body.data!.hostessName} booked for ${date} ${startTime}`,
      });
      onClose();
      navigate(`/reservations`);
    } catch {
      toast({ title: "Error", description: "Network error. Please retry.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Schedule helpers
  const scheduleMap = new Map<number, ScheduleDay>(
    schedData?.weeklySchedule.map(s => [s.dayOfWeek, s]) ?? []
  );
  const todayDow = new Date().getDay();
  const flag = profile.nationalityCode ? (NATIONALITY_FLAGS[profile.nationalityCode] ?? "🌏") : "🌏";

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-end bg-black/70 backdrop-blur-sm">
      {/* Click-outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative z-10 w-full max-w-lg h-full flex flex-col bg-[#0d0d12] border-l border-white/8 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-4 px-5 py-4 border-b border-white/8 bg-black/30">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {profile.staffName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{flag}</span>
              <h3 className="font-display text-base font-bold truncate">{profile.staffName}</h3>
              <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                profile.availableToday ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30"
              }`}>
                {profile.availableToday ? "Available" : "Unavailable"}
              </span>
            </div>
            {schedData?.currentlyBusy ? (
              <p className="text-xs text-amber-400 mt-0.5">
                🔴 Currently in session · {schedData.currentlyBusy.reservation_no}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                MYR {schedData?.hourlyRate ?? "—"}/hr
                {profile.agentName ? ` · ${profile.agentName}` : " · Direct Hire"}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/8">
          {(["schedule", "book"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "schedule" ? (
                <span className="flex items-center justify-center gap-2"><CalendarDays className="w-4 h-4" /> Schedule</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><CalendarPlus className="w-4 h-4" /> Book Now</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "schedule" ? (
            /* ── Schedule Tab ── */
            <div className="p-5 space-y-5">
              {schedLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <>
                  {/* Weekly grid */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Weekly Schedule</h4>
                    <div className="space-y-1.5">
                      {[1,2,3,4,5,6,0].map(dow => {
                        const sched = scheduleMap.get(dow);
                        const isToday = dow === todayDow;
                        return (
                          <div
                            key={dow}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                              isToday
                                ? "bg-primary/8 border border-primary/20"
                                : "bg-white/3 border border-white/5"
                            }`}
                          >
                            <span className={`w-8 text-xs font-bold shrink-0 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                              {DAY_NAMES[dow]}
                              {isToday && <span className="ml-0.5 text-[8px]">▶</span>}
                            </span>
                            {sched ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className={`font-mono text-xs ${isToday ? "text-foreground font-semibold" : "text-foreground/80"}`}>
                                  {sched.shiftStart.slice(0, 5)} — {sched.shiftEnd.slice(0, 5)}
                                </span>
                                {sched.isOvernight && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20 shrink-0">
                                    overnight
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40 flex-1">Off</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allowed branches */}
                  {schedData?.allowedBranches && schedData.allowedBranches.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Working Branches</h4>
                      <div className="space-y-1.5">
                        {schedData.allowedBranches.map(b => (
                          <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-foreground/90">{b.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{b.internal_code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick book CTA */}
                  <Button
                    className="w-full gap-2"
                    onClick={() => setTab("book")}
                  >
                    <CalendarPlus className="w-4 h-4" /> Proceed to Book
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* ── Book Tab ── */
            <div className="p-5 space-y-5">

              {/* Type: Incall / Outcall */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Service Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsOutcall(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                      !isOutcall
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "bg-white/3 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Incall</span>
                    <span className="text-[10px] font-normal opacity-70">At Venue</span>
                  </button>
                  <button
                    onClick={() => setIsOutcall(true)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                      isOutcall
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "bg-white/3 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Outcall</span>
                    <span className="text-[10px] font-normal opacity-70">Client Location</span>
                  </button>
                </div>
              </div>

              {/* Branch */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  <MapPin className="w-3 h-3 inline mr-1" />Working Branch
                </label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(schedData?.allowedBranches ?? [{ id: profile.branchId, name: profile.branchName, internal_code: "" }]).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    <CalendarDays className="w-3 h-3 inline mr-1" />Date
                  </label>
                  <Input
                    type="date"
                    value={date}
                    min={today}
                    onChange={e => setDate(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />Start Time
                  </label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {["1", "2", "3", "4"].map(h => (
                    <button
                      key={h}
                      onClick={() => setDurationHours(h)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                        durationHours === h
                          ? "bg-primary/15 border-primary/50 text-primary"
                          : "bg-white/3 border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                {schedData?.hourlyRate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Est. MYR <strong className="text-primary">{(schedData.hourlyRate * Number(durationHours)).toFixed(0)}</strong> · {durationHours}h × MYR{schedData.hourlyRate}/hr
                  </p>
                )}
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Info (Optional)</h4>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="bg-white/5 border-white/10 pl-9"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="bg-white/5 border-white/10 pl-9"
                  />
                </div>
              </div>

              {/* Channel + Special Requests */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Booking Via</label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKING_CHANNELS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Requests</label>
                  <Input
                    placeholder="Special requests..."
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              {/* Summary banner */}
              <div className="bg-primary/6 border border-primary/15 rounded-xl px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hostess</span>
                  <span className="font-semibold">{profile.staffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold">{isOutcall ? "Outcall" : "Incall"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-semibold">{date} {startTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{durationHours}h</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "book" && (
          <div className="shrink-0 border-t border-white/8 px-5 py-4 bg-black/20 flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleBook}
              disabled={submitting || !date || !startTime || !branchId}
              className="flex-1 gap-2 font-semibold"
            >
              <CalendarPlus className="w-4 h-4" />
              {submitting ? "Creating..." : "Confirm Booking"}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Hostess Card ─────────────────────────────────────────────────
function HostessCard({
  profile,
  onToggleAvailability,
  onBook,
}: {
  profile: HostessProfile;
  onToggleAvailability: (id: string, val: boolean) => void;
  onBook: (p: HostessProfile) => void;
}) {
  const flag = profile.nationalityCode ? (NATIONALITY_FLAGS[profile.nationalityCode] ?? "🌏") : "🌏";

  return (
    <Card className="overflow-hidden hover:border-white/20 transition-all group flex flex-col">
      {/* Photo — 3:4 ratio */}
      <div className="relative w-full" style={{ paddingTop: "133.3%" }}>
        {profile.primaryPhoto ? (
          <img
            src={profile.primaryPhoto}
            alt={profile.staffName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.staffName)}&background=1a1a2e&color=d4a84b&size=400`;
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
            <span className="text-5xl text-white/20">{profile.staffName.charAt(0)}</span>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {profile.isFeatured && (
            <span className="bg-amber-500/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5" /> Featured
            </span>
          )}
          <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[profile.status] ?? STATUS_COLORS.inactive}`}>
            {profile.status}
          </span>
        </div>

        {/* Available today pill */}
        <button
          className="absolute top-2 right-2"
          onClick={(e) => { e.preventDefault(); onToggleAvailability(profile.id, !profile.availableToday); }}
        >
          <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            profile.availableToday ? "bg-green-500/90 text-white" : "bg-black/60 text-white/50"
          }`}>
            {profile.availableToday
              ? <><ToggleRight className="w-3 h-3" /> Available</>
              : <><ToggleLeft className="w-3 h-3" /> Off</>}
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{flag}</span>
            <p className="font-semibold text-sm truncate">{profile.staffName}</p>
          </div>
          <p className="text-xs text-muted-foreground">{profile.staffCode}</p>
        </div>

        {/* Languages */}
        {profile.languagesSpoken.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.languagesSpoken.slice(0, 4).map(l => (
              <span key={l} className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/70">
                {LANG_LABELS[l] ?? l.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Agency + Commission */}
        {profile.agentName ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] bg-violet-500/15 border border-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded truncate">
              🏢 {profile.agentName}
            </span>
            {profile.agencyCommissionRate !== null && (
              <span className="text-[10px] text-amber-400/80">
                Commission: {(profile.agencyCommissionRate * 100).toFixed(0)}%
                {profile.agencyCommissionType === "pct" ? "" : ` (${profile.agencyCommissionType})`}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">Direct Hire</span>
        )}

        {/* Multi-branch indicator */}
        {profile.allowedBranchIds.length > 1 && (
          <span className="text-[10px] bg-blue-500/15 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
            🏬 {profile.allowedBranchIds.length} branches
          </span>
        )}

        {/* Services price */}
        {profile.minServicePrice !== null && (
          <p className="text-xs text-primary/80">
            From <strong>MYR {profile.minServicePrice.toFixed(0)}/hr</strong>
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto pt-1 flex flex-col gap-1.5">
          <Button
            size="sm"
            onClick={() => onBook(profile)}
            disabled={profile.status !== "active"}
            className="w-full text-xs gap-1.5 bg-primary/90 hover:bg-primary text-black font-semibold"
          >
            <CalendarPlus className="w-3 h-3" /> Book
          </Button>
          <Link href={`/staff/hostesses/${profile.id}`}>
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
              <Edit className="w-3 h-3" /> View / Edit
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function HostessProfiles() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("__all__");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [bookingProfile, setBookingProfile] = useState<HostessProfile | null>(null);

  const authH = token ? { Authorization: `Bearer ${token}` } : {};

  // Branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => fetch("/api/branches", { headers: authH }).then(r => r.json()),
  });
  const branches: Branch[] = branchesData?.data ?? [];

  // Profiles
  const params = new URLSearchParams();
  if (branchId !== "__all__") params.set("branch_id", branchId);
  if (status !== "__all__") params.set("status", status);
  if (availableOnly) params.set("available_today", "true");
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["hostess-profiles", branchId, status, availableOnly, search],
    queryFn: () =>
      fetch(`/api/hostess-profiles?${params}`, { headers: authH }).then(r => r.json()),
  });
  const profiles: HostessProfile[] = data?.data ?? [];

  // Toggle availability
  const toggleAvail = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const r = await fetch(`/api/hostess-profiles/${id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ availableToday: val }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostess-profiles"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update availability", variant: "destructive" }),
  });

  const available = profiles.filter(p => p.availableToday).length;

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Hostess Profiles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profiles.length} profiles · {available} available today
          </p>
        </div>
        <Link href="/staff/hostesses/new">
          <Button className="gap-2">
            <UserPlus className="w-4 h-4" /> Add Profile
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or code..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Branches</SelectItem>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={availableOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setAvailableOnly(v => !v)}
          className="gap-2"
        >
          <ToggleRight className="w-4 h-4" />
          Available Today
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-white/5 animate-pulse" style={{ paddingTop: "180%" }} />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">💃</p>
          <p>No hostess profiles found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {profiles.map(p => (
            <HostessCard
              key={p.id}
              profile={p}
              onToggleAvailability={(id, val) => toggleAvail.mutate({ id, val })}
              onBook={setBookingProfile}
            />
          ))}
        </div>
      )}

      {/* Book Modal */}
      {bookingProfile && (
        <BookModal
          profile={bookingProfile}
          onClose={() => setBookingProfile(null)}
        />
      )}
    </div>
    </DashboardLayout>
  );
}
