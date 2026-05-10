import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  ClipboardList, Clock, LogIn, LogOut, CheckCircle,
  XCircle, Loader2, MapPin, AlertCircle,
} from "lucide-react";

interface Assignment {
  id: string;
  reservation_id: string;
  reservation_no: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number | null;
  room_name: string | null;
  status: string;
  is_primary: boolean;
  session_fee: number | null;
  assigned_at: string;
}

interface Commission {
  id: string;
  start_at: string;
  end_at: string | null;
  hours_worked: number | null;
  rate_per_hour: number | null;
  gross_amount: number | null;
  payout_rate: number | null;
  net_payout: number | null;
  late_charge_amount: number | null;
  currency: string;
  status: string;
  reservation_no: string | null;
  room_name: string | null;
}

interface TodayStatus {
  id: string | null;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  hours_worked: number | null;
  gps_lat_in: number | null;
  gps_lng_in: number | null;
  gps_lat_out: number | null;
  gps_lng_out: number | null;
}

interface Banner { type: "success" | "error"; text: string }

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colours: Record<string, string> = {
    active:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    completed:  "bg-blue-500/15 text-blue-400 border-blue-500/20",
    cancelled:  "bg-red-500/15 text-red-400 border-red-500/20",
    confirmed:  "bg-amber-500/15 text-amber-400 border-amber-500/20",
    checked_in: "bg-primary/15 text-primary border-primary/20",
  };
  // Try a translation by status, else fall back to spaced raw value
  const label = t(`dashboards.common.order_status.${status}`, { defaultValue: t(`dashboards.common.delivery_status.${status}`, { defaultValue: status.replace("_", " ") }) });
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${colours[status] ?? "bg-white/10 text-muted-foreground border-white/10"}`}>
      {label}
    </span>
  );
}

async function getGPS(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { timeout: 6000 }
    );
  });
}

export default function HostessDashboard() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { token } = useAuthStore();
  const [banner, setBanner] = useState<Banner | null>(null);

  const authHeaders = (extra?: Record<string, string>) => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  });

  const showBanner = (type: Banner["type"], text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 5000);
  };

  // Today's clock status
  const todayQuery = useQuery({
    queryKey: ["hostess-today"],
    queryFn: async () => {
      const r = await fetch("/api/hostess/today", { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<TodayStatus>;
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["hostess-assignments"],
    queryFn: async () => {
      const r = await fetch("/api/hostess/assignments", { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed");
      const j = (await r.json()) as { data: Assignment[] };
      return j.data;
    },
  });

  const commissionsQuery = useQuery({
    queryKey: ["hostess-commissions"],
    queryFn: async () => {
      const r = await fetch("/api/hostess/commissions?range=last_3_months", { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ data: Commission[]; total: number }>;
    },
  });

  // Clock-in mutation
  const clockInMut = useMutation({
    mutationFn: async () => {
      const { lat, lng } = await getGPS();
      const r = await fetch("/api/hostess/clock-in", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? t("dashboards.hostess.clock_in_failed"));
      return { data: d, gps: lat !== null };
    },
    onSuccess: ({ data, gps }) => {
      const time = data.clock_in ? new Date(data.clock_in as string).toLocaleTimeString(i18n.language) : "";
      showBanner("success", `${t("dashboards.hostess.clocked_in_at", { time })}${gps ? ` (${t("dashboards.hostess.gps_captured")})` : ""}`);
      qc.invalidateQueries({ queryKey: ["hostess-today"] });
    },
    onError: (err) => showBanner("error", (err as Error).message),
  });

  // Clock-out mutation
  const clockOutMut = useMutation({
    mutationFn: async () => {
      const { lat, lng } = await getGPS();
      const r = await fetch("/api/hostess/clock-out", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? t("dashboards.hostess.clock_out_failed"));
      return { data: d, gps: lat !== null };
    },
    onSuccess: ({ data, gps }) => {
      const time = data.clock_out ? new Date(data.clock_out as string).toLocaleTimeString(i18n.language) : "";
      showBanner("success", `${t("dashboards.hostess.clocked_out_at", { time })}${gps ? ` (${t("dashboards.hostess.gps_captured")})` : ""}`);
      qc.invalidateQueries({ queryKey: ["hostess-today"] });
    },
    onError: (err) => showBanner("error", (err as Error).message),
  });

  const today    = todayQuery.data;
  const isClockedIn  = !!(today?.clock_in && !today?.clock_out);
  const isClockedOut = !!(today?.clock_in && today?.clock_out);
  const actionPending = clockInMut.isPending || clockOutMut.isPending;

  const assignments  = assignmentsQuery.data ?? [];
  const commissions  = commissionsQuery.data?.data ?? [];
  const totalPayout  = commissionsQuery.data?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> {t("dashboards.hostess.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Banner */}
        {banner && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm border ${
            banner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {banner.type === "success"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span className="flex-1">{banner.text}</span>
            <button onClick={() => setBanner(null)} className="font-bold opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Attendance Card */}
        <Card className="p-5 bg-black/40 border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> {t("dashboards.hostess.todays_attendance")}
            </h2>
            {todayQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Status display */}
          {today?.clock_in && (
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg p-2 bg-white/5 border border-white/8">
                <p className="text-xs text-muted-foreground mb-0.5">{t("dashboards.hostess.clocked_in")}</p>
                <p className="font-mono font-medium">
                  {new Date(today.clock_in).toLocaleTimeString(i18n.language)}
                </p>
                {today.gps_lat_in && (
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    <MapPin className="w-3 h-3" /> {t("dashboards.hostess.gps_label")}
                  </p>
                )}
              </div>
              {today.clock_out ? (
                <div className="rounded-lg p-2 bg-white/5 border border-white/8">
                  <p className="text-xs text-muted-foreground mb-0.5">{t("dashboards.hostess.clocked_out")}</p>
                  <p className="font-mono font-medium">
                    {new Date(today.clock_out).toLocaleTimeString(i18n.language)}
                  </p>
                  {today.hours_worked && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t("dashboards.common.hours_worked", { n: Number(today.hours_worked).toFixed(1) })}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-2 bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    {t("dashboards.common.on_duty")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => clockInMut.mutate()}
              disabled={actionPending || isClockedIn || isClockedOut}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 disabled:bg-white/10 disabled:text-muted-foreground transition-colors"
            >
              {clockInMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {t("dashboards.hostess.clock_in")}
            </button>
            <button
              onClick={() => clockOutMut.mutate()}
              disabled={actionPending || !isClockedIn}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-400 disabled:bg-white/10 disabled:text-muted-foreground transition-colors"
            >
              {clockOutMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {t("dashboards.hostess.clock_out")}
            </button>
          </div>

          {isClockedOut && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              <CheckCircle className="w-3 h-3 inline mr-1 text-emerald-400" />
              {t("dashboards.hostess.attendance_completed")}
            </p>
          )}
        </Card>

        {/* Commission Summary */}
        <Card className="p-5 bg-black/40 border-white/5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            {t("dashboards.hostess.my_commission")} <span className="text-xs text-muted-foreground font-normal">{t("dashboards.hostess.last_3_months")}</span>
          </h2>
          {commissionsQuery.isLoading ? (
            <div className="h-10 bg-white/5 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-3xl font-display font-bold text-primary mb-1">
                {formatCurrency(totalPayout)}
              </p>
              <p className="text-xs text-muted-foreground">{t("dashboards.hostess.sessions_count", { n: commissions.length })}</p>
              {commissions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {commissions.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-0">
                      <span className="text-muted-foreground">
                        {new Date(c.start_at).toLocaleDateString(i18n.language)}
                        {c.room_name && ` — ${c.room_name}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <span className="font-mono font-medium">{formatCurrency(Number(c.net_payout ?? 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Recent Assignments */}
        <Card className="p-5 bg-black/40 border-white/5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            {t("dashboards.hostess.recent_assignments")}
          </h2>
          {assignmentsQuery.isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-6">
              <XCircle className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("dashboards.common.no_assignments_yet")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.room_name ?? t("dashboards.common.room")}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.reservation_no ?? "—"}
                      {a.is_primary && <span className="ml-1 text-primary">• {t("dashboards.hostess.primary")}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={a.status} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.assigned_at).toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </DashboardLayout>
  );
}
