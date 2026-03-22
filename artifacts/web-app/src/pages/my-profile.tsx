import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useEffect, useState } from "react";
import {
  User, Building2, Calendar, Clock, Phone, Mail, Star,
  AlertTriangle, ChevronRight, Car, ChefHat, LayoutList,
  Briefcase, Shield, Edit2, Check, X, Globe, Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── Role accent colours ────────────────────────────────────────────────────
const ROLE_ACCENT: Record<string, string> = {
  investor:       "#f5c842",
  branch_manager: "#2dd4bf",
  manager:        "#60a5fa",
  hostess:        "#e8407a",
  driver:         "#fb923c",
  kitchen:        "#4ade80",
  hall:           "#a78bfa",
  general:        "#9a9baa",
  super_admin:    "#ffffff",
  admin:          "#ffffff",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:    "Super Admin",
  admin:          "Admin",
  investor:       "Investor",
  branch_manager: "Branch Manager",
  manager:        "Manager",
  hostess:        "Hostess",
  driver:         "Driver",
  kitchen:        "Kitchen Staff",
  hall:           "Hall Staff",
  general:        "General Staff",
};

const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文 (Chinese)" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "th", label: "ภาษาไทย (Thai)" },
  { value: "ko", label: "한국어 (Korean)" },
  { value: "ja", label: "日本語 (Japanese)" },
];

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#13141a] p-4 flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ?? "#ffffff" }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Warning Banner ─────────────────────────────────────────────────────────
function WarnBanner({ level, message }: { level: "warn" | "critical"; message: string }) {
  const bg   = level === "critical" ? "bg-red-500/15 border-red-500/40"   : "bg-orange-500/15 border-orange-500/40";
  const text = level === "critical" ? "text-red-400"                      : "text-orange-400";
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${bg} ${text}`}>
      <AlertTriangle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Avatar Circle ──────────────────────────────────────────────────────────
function AvatarCircle({ name, role, photo }: { name: string; role: string; photo?: string | null }) {
  const accent = ROLE_ACCENT[role] ?? "#ffffff";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="relative size-24 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
      style={{ background: accent + "22", border: `3px solid ${accent}` }}
    >
      {photo
        ? <img src={photo} alt={name} className="size-full rounded-full object-cover" />
        : <span style={{ color: accent }}>{initials}</span>
      }
    </div>
  );
}

// ── Info Row ───────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon size={15} className="text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ── Section Card ───────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, accent }: {
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#13141a] p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={16} style={{ color: accent ?? "#9ca3af" }} />}
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent ?? "#9ca3af" }}>
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  employee_code: string | null;
  role: string;
  employment_type: string;
  hire_date: string | null;
  is_active: boolean;
  profile_photo: string | null;
  language_pref: string;
  last_login_at: string | null;
  created_at: string;
  branch_name: string | null;
  branch_code: string | null;
  branch_address: string | null;
  branch_operating_hours: string | null;
  phone_masked: string;
  email_masked: string;
  bank_last4: string | null;
  bank_name: string | null;
  attendance_summary: {
    days_present: number;
    days_late: number;
    days_absent: number;
    total_hours: number;
    ot_hours: number;
  };
  hostess_profile?: {
    hostess_profile_id: string;
    availability_status: string;
    languages_spoken: string[];
    agency_id: string | null;
    agency_name: string | null;
    agency_contact: string | null;
    agency_contract_start: string | null;
    agency_contract_end: string | null;
    total_sessions: number;
    avg_rating_30d: number;
  } | null;
  driver_info?: {
    license_masked: string | null;
    license_expiry: string | null;
    expiry_warning: "none" | "warn" | "critical";
    total_trips: number;
  };
  kitchen_info?: { orders_today: number; orders_this_week: number };
  general_info?: { upcoming_shifts: number };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MyProfile() {
  const { token, user } = useAuthStore();
  const { toast } = useToast();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [editName, setEditName] = useState("");
  const [editLang, setEditLang] = useState("en");

  const accent = ROLE_ACCENT[user?.role ?? ""] ?? "#ffffff";

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { profile: Profile };
      setProfile(data.profile);
      setEditName(data.profile.full_name);
      setEditLang(data.profile.language_pref ?? "en");
    } catch (err) {
      toast({ title: "Failed to load profile", variant: "destructive" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: editName, language_pref: editLang }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Profile updated" });
      setEditing(false);
      await fetchProfile();
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { fetchProfile(); }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading profile…
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Profile not found.
        </div>
      </DashboardLayout>
    );
  }

  const att = profile.attendance_summary;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Profile</h1>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 size={14} className="mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveProfile} disabled={saving}>
                <Check size={14} className="mr-1" /> {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X size={14} className="mr-1" /> Cancel
              </Button>
            </div>
          )}
        </div>

        {/* ── Identity Card ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-[#13141a] p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <AvatarCircle name={profile.full_name} role={profile.role} photo={profile.profile_photo} />

            <div className="flex-1 space-y-3">
              {editing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-bold bg-white/5 border-white/20 max-w-xs"
                />
              ) : (
                <h2 className="text-xl font-bold">{profile.full_name}</h2>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <Badge style={{ backgroundColor: accent + "33", color: accent, border: `1px solid ${accent}55` }}>
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Badge>
                <Badge variant={profile.is_active ? "default" : "destructive"} className="text-[11px]">
                  {profile.is_active ? "Active" : "Inactive"}
                </Badge>
                {profile.employee_code && (
                  <span className="text-xs text-muted-foreground font-mono">#{profile.employee_code}</span>
                )}
              </div>

              {/* Language selector */}
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-muted-foreground" />
                {editing ? (
                  <Select value={editLang} onValueChange={setEditLang}>
                    <SelectTrigger className="w-44 h-8 bg-white/5 border-white/20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {LANGUAGES.find((l) => l.value === profile.language_pref)?.label ?? profile.language_pref}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <InfoRow icon={Building2} label="Branch"       value={profile.branch_name ?? "—"} />
            <InfoRow icon={Briefcase} label="Employment"   value={profile.employment_type} />
            <InfoRow icon={Calendar}  label="Joined"       value={fmtDate(profile.hire_date)} />
            <InfoRow icon={Clock}     label="Last Login"   value={fmtDate(profile.last_login_at)} />
            <InfoRow icon={Phone}     label="Phone"        value={profile.phone_masked || "—"} />
            <InfoRow icon={Mail}      label="Email"        value={profile.email_masked || "—"} />
            {profile.bank_last4 && (
              <InfoRow icon={Shield} label="Bank A/C" value={`${profile.bank_name ?? ""} ****${profile.bank_last4}`} />
            )}
          </div>
        </div>

        {/* ── Attendance KPIs (last 30 days) ──────────────────────────────── */}
        <SectionCard title="Attendance — Last 30 Days" icon={Calendar} accent={accent}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Days Present" value={att.days_present}  accent="#4ade80" />
            <KpiCard label="Days Late"    value={att.days_late}     accent="#fb923c" />
            <KpiCard label="Days Absent"  value={att.days_absent}   accent="#f87171" />
            <KpiCard label="Total Hours"  value={Number(att.total_hours).toFixed(1)} />
            <KpiCard label="OT Hours"     value={Number(att.ot_hours).toFixed(1)} accent="#f5c842" />
          </div>
        </SectionCard>

        {/* ── Role-specific sections ───────────────────────────────────────── */}

        {/* HOSTESS */}
        {profile.role === "hostess" && profile.hostess_profile && (() => {
          const hp = profile.hostess_profile!;
          return (
            <>
              <SectionCard title="Hostess Profile" icon={Star} accent={ROLE_ACCENT.hostess}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard label="Total Sessions"   value={hp.total_sessions}                    accent={ROLE_ACCENT.hostess} />
                  <KpiCard label="Avg Rating (30d)"  value={Number(hp.avg_rating_30d).toFixed(1)} accent="#f5c842" sub="out of 5.0" />
                  <KpiCard label="Status"            value={hp.availability_status ?? "—"} />
                </div>
                {hp.languages_spoken?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hp.languages_spoken.map((l) => (
                      <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                )}
              </SectionCard>

              {hp.agency_id && hp.agency_name && (
                <SectionCard title="Agency Details" icon={Briefcase} accent={ROLE_ACCENT.hostess}>
                  <InfoRow icon={Briefcase} label="Agency"          value={hp.agency_name} />
                  <InfoRow icon={User}      label="Contact"         value={hp.agency_contact ?? "—"} />
                  <InfoRow icon={Calendar}  label="Contract Start"  value={fmtDate(hp.agency_contract_start)} />
                  <InfoRow icon={Calendar}  label="Contract End"    value={fmtDate(hp.agency_contract_end)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Agency model — deductions visible in Account Ledger
                  </p>
                </SectionCard>
              )}
            </>
          );
        })()}

        {/* DRIVER */}
        {profile.role === "driver" && profile.driver_info && (() => {
          const di = profile.driver_info!;
          return (
            <SectionCard title="Driver Information" icon={Car} accent={ROLE_ACCENT.driver}>
              {di.expiry_warning !== "none" && (
                <WarnBanner
                  level={di.expiry_warning}
                  message={`License expiry warning: expires ${fmtDate(di.license_expiry)}`}
                />
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard label="Total Trips"    value={di.total_trips ?? 0}        accent={ROLE_ACCENT.driver} />
                <KpiCard label="License Expiry" value={fmtDate(di.license_expiry)} accent={di.expiry_warning === "critical" ? "#f87171" : di.expiry_warning === "warn" ? "#fb923c" : "#9ca3af"} />
                <KpiCard label="License (masked)" value={di.license_masked ?? "—"} />
              </div>
              <p className="text-xs text-muted-foreground">
                Guest phone numbers are never shown in your view.
              </p>
            </SectionCard>
          );
        })()}

        {/* KITCHEN */}
        {profile.role === "kitchen" && profile.kitchen_info && (
          <SectionCard title="Kitchen Stats" icon={ChefHat} accent={ROLE_ACCENT.kitchen}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Orders Today"    value={profile.kitchen_info.orders_today}     accent={ROLE_ACCENT.kitchen} />
              <KpiCard label="Orders This Week" value={profile.kitchen_info.orders_this_week} />
            </div>
          </SectionCard>
        )}

        {/* HALL */}
        {profile.role === "hall" && (
          <SectionCard title="Hall Assignment" icon={LayoutList} accent={ROLE_ACCENT.hall}>
            <InfoRow icon={Building2} label="Branch" value={profile.branch_name ?? "—"} />
            <p className="text-xs text-muted-foreground">
              View room numbers and service requests only. Guest PII is hidden.
            </p>
          </SectionCard>
        )}

        {/* GENERAL */}
        {profile.role === "general" && profile.general_info && (
          <SectionCard title="Employment Details" icon={Briefcase} accent={ROLE_ACCENT.general}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Upcoming Shifts (14d)" value={profile.general_info.upcoming_shifts} />
            </div>
            <InfoRow icon={Building2} label="Branch"      value={profile.branch_name ?? "—"} />
            <InfoRow icon={Calendar}  label="Contract End" value={fmtDate(profile.contract_end)} />
          </SectionCard>
        )}

        {/* BRANCH MANAGER */}
        {profile.role === "branch_manager" && (
          <SectionCard title="Branch Management" icon={Building2} accent={ROLE_ACCENT.branch_manager}>
            <InfoRow icon={Building2} label="Branch"   value={profile.branch_name ?? "—"} />
            <InfoRow icon={Shield}    label="Code"     value={profile.branch_code ?? "—"} />
            <InfoRow icon={Calendar}  label="Address"  value={profile.branch_address ?? "—"} />
            <InfoRow icon={Clock}     label="Hours"    value={profile.branch_operating_hours ?? "—"} />
          </SectionCard>
        )}

        {/* MANAGER */}
        {profile.role === "manager" && (
          <SectionCard title="Manager Info" icon={Shield} accent={ROLE_ACCENT.manager}>
            <InfoRow icon={Building2} label="Branch" value={profile.branch_name ?? "—"} />
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 text-xs text-yellow-400">
              Comp approvals create an immutable audit log entry.
            </div>
          </SectionCard>
        )}

      </div>
    </DashboardLayout>
  );
}
