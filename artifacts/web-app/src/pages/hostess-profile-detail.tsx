import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Trash2, Upload, Star, StarOff,
  Plus, Edit, Check, X, GripVertical,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface HostessProfile {
  id: string; staffId: string; staffName: string; staffCode: string;
  branchId: string; branchName: string;
  allowedBranchIds: string[];
  agencyId: string | null; agentName: string | null;
  agencyHostessCode: string | null;
  agencyCommissionRate: number | null; agencyCommissionType: string | null;
  nationality: string | null;
  nationalityCode: string | null; dateOfBirth: string | null;
  heightCm: number | null; weightKg: number | null; bodySize: string | null;
  bustCm: number | null; waistCm: number | null; hipCm: number | null;
  introText: string | null; introTranslations: Record<string, string>;
  languagesSpoken: string[]; status: string; availableToday: boolean;
  displayOrder: number; isFeatured: boolean; age: number | null;
  primaryPhoto: string | null; photoCount: number;
  pdpaConsentGiven: boolean; pdpaConsentDate: string | null;
}

interface Agent { id: string; name: string; commissionRate: number | null; commissionType: string | null; }
interface Branch { id: string; name: string; internalCode: string; }

interface HostessService {
  id: string; serviceCode: string; serviceName: string;
  priceAmount: number; currencyCode: string; priceUnit: string;
  durationMinutes: number | null; isActive: boolean;
  hostessCommissionPct: number | null; displayOrder: number;
  serviceTranslations: Record<string, string>;
}

interface HostessPhoto {
  id: string; url: string; thumbMd: string;
  isPrimary: boolean; isApproved: boolean; displayOrder: number;
}

// ─── Helpers ─────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "MY", name: "Malaysian", flag: "🇲🇾" }, { code: "TH", name: "Thai", flag: "🇹🇭" },
  { code: "VN", name: "Vietnamese", flag: "🇻🇳" }, { code: "PH", name: "Filipino", flag: "🇵🇭" },
  { code: "ID", name: "Indonesian", flag: "🇮🇩" }, { code: "KR", name: "Korean", flag: "🇰🇷" },
  { code: "JP", name: "Japanese", flag: "🇯🇵" }, { code: "CN", name: "Chinese", flag: "🇨🇳" },
  { code: "SG", name: "Singaporean", flag: "🇸🇬" }, { code: "IN", name: "Indian", flag: "🇮🇳" },
  { code: "BD", name: "Bangladeshi", flag: "🇧🇩" }, { code: "MM", name: "Myanmar", flag: "🇲🇲" },
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "zh-Hans", label: "中文 (Simplified)" },
  { code: "zh-Hant", label: "中文 (Traditional)" }, { code: "ko", label: "한국어" },
  { code: "th", label: "ภาษาไทย" }, { code: "ms", label: "Bahasa Melayu" },
  { code: "vi", label: "Tiếng Việt" }, { code: "id", label: "Bahasa Indonesia" },
  { code: "tl", label: "Filipino" }, { code: "ta", label: "தமிழ்" },
];

const SERVICE_CODES = ["COMPANION", "POURING", "SINGING", "DANCE", "CUSTOM"];
const PRICE_UNITS = ["per_hour", "per_session", "flat_rate", "per_bottle"];

function statusColor(s: string) {
  return {
    active: "bg-green-500/20 text-green-300 border-green-500/30",
    inactive: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    on_leave: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    suspended: "bg-red-500/20 text-red-300 border-red-500/30",
  }[s] ?? "bg-slate-500/20 text-slate-300";
}

// ─── Main Component ───────────────────────────────────────────────
export default function HostessProfileDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"basic" | "intro" | "services" | "photos">("basic");
  const [introLang, setIntroLang] = useState("en");
  const fileRef = useRef<HTMLInputElement>(null);

  const authH = token ? { Authorization: `Bearer ${token}` } : {};

  // ─── Fetch profile ───────────────────────────────────────────
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["hostess-profile", id],
    queryFn: () => fetch(`/api/hostess-profiles/${id}`, { headers: authH }).then(r => r.json()),
    enabled: !!id,
  });
  const profile: HostessProfile | null = profileData?.data ?? null;

  // ─── Fetch agents ───────────────────────────────────────────
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents", { headers: authH }).then(r => r.json()),
  });
  const agents: Agent[] = (agentsData?.data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id,
    name: a.name,
    commissionRate: a.commissionRate ?? a.commission_rate ?? null,
    commissionType: a.commissionType ?? a.commission_type ?? null,
  }));

  // ─── Fetch branches ──────────────────────────────────────────
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => fetch("/api/branches", { headers: authH }).then(r => r.json()),
  });
  const branches: Branch[] = branchesData?.data ?? [];

  // ─── Form state ─────────────────────────────────────────────
  const [form, setForm] = useState<Partial<HostessProfile>>({});
  const f = (k: keyof HostessProfile, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const merged = { ...profile, ...form } as HostessProfile;

  // ─── Services ────────────────────────────────────────────────
  const { data: svcData } = useQuery({
    queryKey: ["hostess-services", id],
    queryFn: () => fetch(`/api/hostess-profiles/${id}/services`, { headers: authH }).then(r => r.json()),
    enabled: !!id,
  });
  const services: HostessService[] = svcData?.data ?? [];

  // ─── Photos ──────────────────────────────────────────────────
  const { data: photoData } = useQuery({
    queryKey: ["hostess-photos", id],
    queryFn: () => fetch(`/api/hostess-profiles/${id}/photos`, { headers: authH }).then(r => r.json()),
    enabled: !!id,
  });
  const photos: HostessPhoto[] = photoData?.data ?? [];

  // ─── Save mutation ───────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      const keys: (keyof HostessProfile)[] = [
        "nationality", "nationalityCode", "dateOfBirth", "heightCm", "weightKg",
        "bodySize", "bustCm", "waistCm", "hipCm", "introText", "introTranslations",
        "languagesSpoken", "status", "availableToday", "displayOrder", "isFeatured",
        "agencyId", "agencyHostessCode", "allowedBranchIds",
      ];
      for (const k of keys) {
        if (form[k] !== undefined) body[k] = form[k];
      }
      const r = await fetch(`/api/hostess-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: t("hostess_detail.saved"), description: t("hostess_detail.save_success") });
      qc.invalidateQueries({ queryKey: ["hostess-profile", id] });
      qc.invalidateQueries({ queryKey: ["hostess-profiles"] });
      setForm({});
    },
    onError: () => toast({ title: t("hostess_detail.error"), description: t("hostess_detail.save_failed"), variant: "destructive" }),
  });

  // ─── Add service ─────────────────────────────────────────────
  const [newSvc, setNewSvc] = useState<Partial<HostessService> | null>(null);
  const addSvcMut = useMutation({
    mutationFn: async (svc: Partial<HostessService>) => {
      const r = await fetch(`/api/hostess-profiles/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(svc),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostess-services", id] });
      setNewSvc(null);
    },
  });

  const deleteSvcMut = useMutation({
    mutationFn: async (svcId: string) => {
      await fetch(`/api/hostess-profiles/${id}/services/${svcId}`, {
        method: "DELETE", headers: authH,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hostess-services", id] }),
  });

  // ─── Photo upload ─────────────────────────────────────────────
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("photo", file);
      const r = await fetch(`/api/hostess-profiles/${id}/photos`, {
        method: "POST",
        headers: authH,
        body: fd,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostess-photos", id] });
      toast({ title: t("hostess_detail.uploaded"), description: t("hostess_detail.upload_success") });
    },
    onError: () => toast({ title: t("hostess_detail.error"), description: t("hostess_detail.upload_failed"), variant: "destructive" }),
  });

  const setPrimaryMut = useMutation({
    mutationFn: async (photoId: string) => {
      await fetch(`/api/hostess-profiles/${id}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ isPrimary: true }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hostess-photos", id] }),
  });

  const deletePhotoMut = useMutation({
    mutationFn: async (photoId: string) => {
      await fetch(`/api/hostess-profiles/${id}/photos/${photoId}`, {
        method: "DELETE", headers: authH,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hostess-photos", id] }),
  });

  // ─── Render ──────────────────────────────────────────────────
  if (isLoading) return <DashboardLayout><div className="p-8 text-muted-foreground">{t("hostess_detail.loading")}</div></DashboardLayout>;
  if (!profile) return <DashboardLayout><div className="p-8 text-muted-foreground">{t("hostess_detail.not_found")}</div></DashboardLayout>;

  const countryInfo = COUNTRIES.find(c => c.code === merged.nationalityCode);

  return (
    <DashboardLayout>
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/staff/hostesses")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("hostess_detail.back")}
          </Button>
          <div>
            <h1 className="text-xl font-bold">{profile.staffName}</h1>
            <p className="text-sm text-muted-foreground">{profile.staffCode} · {profile.branchName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs border px-2 py-0.5 rounded-full ${statusColor(merged.status)}`}>
            {merged.status}
          </span>
          {Object.keys(form).length > 0 && (
            <Button size="sm" className="gap-1.5" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="w-3.5 h-3.5" />
              {saveMut.isPending ? t("hostess_detail.saving") : t("hostess_detail.save_changes")}
            </Button>
          )}
        </div>
      </div>

      {/* Profile snapshot bar */}
      <Card className="p-4 flex items-center gap-4">
        <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-white/5">
          {profile.primaryPhoto ? (
            <img src={profile.primaryPhoto} alt="" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.staffName)}&background=1a1a2e&color=d4a84b&size=64`; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-white/20">
              {profile.staffName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("hostess_detail.nationality")}</p>
            <p className="font-medium">{countryInfo ? `${countryInfo.flag} ${countryInfo.name}` : profile.nationality ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("hostess_detail.age_height")}</p>
            <p className="font-medium">{t("hostess_detail.yr_cm", { age: merged.age ?? "—", h: merged.heightCm ?? "—" })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("hostess_detail.agency")}</p>
            <p className="font-medium truncate" title={profile.agentName ?? "—"}>
              {profile.agentName
                ? <><span className="text-violet-400">🏢</span> {profile.agentName}</>
                : <span className="text-muted-foreground/60">{t("hostess_detail.direct_hire")}</span>}
            </p>
            {profile.agencyCommissionRate !== null && (
              <p className="text-[10px] text-amber-400/80 mt-0.5">
                {t("hostess_detail.pct_commission", { pct: (profile.agencyCommissionRate * 100).toFixed(0) })}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("hostess_detail.photos")}</p>
            <p className="font-medium">{t("hostess_detail.approved_count", { n: profile.photoCount })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("hostess_detail.pdpa_consent")}</p>
            <p className={`font-medium ${profile.pdpaConsentGiven ? "text-green-400" : "text-red-400"}`}>
              {profile.pdpaConsentGiven ? t("hostess_detail.given") : t("hostess_detail.pending")}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-0 border border-white/10 rounded-lg overflow-hidden w-fit">
        {(["basic", "intro", "services", "photos"] as const).map(tk => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === tk ? "bg-primary text-black" : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            {tk === "basic" ? t("hostess_detail.tab_basic") : tk === "intro" ? t("hostess_detail.tab_intro") : tk === "services" ? t("hostess_detail.tab_services") : t("hostess_detail.tab_photos")}
          </button>
        ))}
      </div>

      {/* ── Tab: Basic Info ── */}
      {tab === "basic" && (
        <Card className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Nationality */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.nationality")}</label>
              <Select
                value={merged.nationalityCode ?? "__none__"}
                onValueChange={v => {
                  const c = COUNTRIES.find(x => x.code === v);
                  f("nationalityCode", v === "__none__" ? null : v);
                  if (c) f("nationality", c.name);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("hostess_detail.select")}</SelectItem>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date of birth */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.date_of_birth")}</label>
              <DateInput
                value={merged.dateOfBirth?.split("T")[0] ?? ""}
                onChange={e => f("dateOfBirth", e.target.value || null)}
              />
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.height_cm")}</label>
              <Input type="number" min={140} max={185}
                value={merged.heightCm ?? ""} onChange={e => f("heightCm", e.target.value ? parseInt(e.target.value) : null)} />
            </div>

            {/* Weight */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.weight_kg")}</label>
              <Input type="number" step="0.5" min={38} max={90}
                value={merged.weightKg ?? ""} onChange={e => f("weightKg", e.target.value ? parseFloat(e.target.value) : null)} />
            </div>

            {/* Body size */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.body_size")}</label>
              <Select value={merged.bodySize ?? "__none__"} onValueChange={v => f("bodySize", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("hostess_detail.select")}</SelectItem>
                  {["XS", "S", "M", "L", "XL", "XXL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.status")}</label>
              <Select value={merged.status} onValueChange={v => f("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("hostess_detail.status_active")}</SelectItem>
                  <SelectItem value="inactive">{t("hostess_detail.status_inactive")}</SelectItem>
                  <SelectItem value="on_leave">{t("hostess_detail.status_on_leave")}</SelectItem>
                  <SelectItem value="suspended">{t("hostess_detail.status_suspended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bust / Waist / Hip */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">{t("hostess_detail.measurements")}</p>
            <div className="grid grid-cols-3 gap-3">
              {(["bustCm", "waistCm", "hipCm"] as const).map(field => (
                <div key={field} className="space-y-1">
                  <label className="text-xs text-muted-foreground capitalize">{field.replace("Cm", "")}</label>
                  <Input type="number" min={60} max={120}
                    value={(merged[field] as number | null | undefined) ?? ""}
                    onChange={e => f(field, e.target.value ? parseInt(e.target.value) : null)} />
                </div>
              ))}
            </div>
          </div>

          {/* Languages spoken */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">{t("hostess_detail.languages_spoken")}</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => {
                const active = (merged.languagesSpoken ?? []).includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      const cur = merged.languagesSpoken ?? [];
                      f("languagesSpoken", active ? cur.filter(l => l !== lang.code) : [...cur, lang.code]);
                    }}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      active ? "bg-primary text-black border-primary" : "border-white/20 text-muted-foreground hover:border-white/40"
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-yellow-400"
                checked={merged.isFeatured ?? false}
                onChange={e => f("isFeatured", e.target.checked)}
              />
              <span className="text-sm">{t("hostess_detail.featured_highlight")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-green-400"
                checked={merged.availableToday ?? false}
                onChange={e => f("availableToday", e.target.checked)}
              />
              <span className="text-sm">{t("hostess_detail.available_today")}</span>
            </label>
          </div>

          {/* ── Agency & Commission ── */}
          <div className="pt-2 border-t border-white/8">
            <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wide">{t("hostess_detail.agency_commission")}</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Agent */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.agency_agent")}</label>
                <Select
                  value={merged.agencyId ?? "__none__"}
                  onValueChange={v => f("agencyId", v === "__none__" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder={t("hostess_detail.no_agency")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("hostess_detail.direct_hire_option")}</SelectItem>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agency Hostess Code */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">{t("hostess_detail.agency_hostess_code")}</label>
                <Input
                  placeholder="e.g. AGT-007"
                  value={merged.agencyHostessCode ?? ""}
                  onChange={e => f("agencyHostessCode", e.target.value || null)}
                />
              </div>
            </div>

            {/* Show agency commission rate (read-only from agent record) */}
            {merged.agencyId && (() => {
              const agent = agents.find(a => a.id === (form.agencyId ?? merged.agencyId));
              const rate = agent?.commissionRate ?? merged.agencyCommissionRate;
              const type = agent?.commissionType ?? merged.agencyCommissionType;
              if (rate === null || rate === undefined) return null;
              const pct = type === "pct" || !type ? `${(rate * 100).toFixed(0)}%` : `${rate}`;
              return (
                <p className="mt-2 text-xs text-amber-400/90">
                  {t("hostess_detail.agency_commission_rate_label")}<strong>{pct}</strong>
                  {type && type !== "pct" ? ` (${type})` : ""}
                  {" "}<span className="text-muted-foreground">{t("hostess_detail.per_service_note")}</span>
                </p>
              );
            })()}
          </div>

          {/* ── Multi-Branch Assignments ── */}
          <div className="pt-2 border-t border-white/8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{t("hostess_detail.allowed_branches")}</p>
              <span className="text-[10px] text-muted-foreground">{t("hostess_detail.primary_auto_included")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {branches.map(b => {
                const isPrimary = b.id === merged.branchId;
                const allowed: string[] = merged.allowedBranchIds ?? [];
                const isChecked = isPrimary || allowed.includes(b.id);
                return (
                  <button
                    key={b.id}
                    disabled={isPrimary}
                    onClick={() => {
                      if (isPrimary) return;
                      const cur: string[] = merged.allowedBranchIds ?? [];
                      const next = cur.includes(b.id) ? cur.filter(x => x !== b.id) : [...cur, b.id];
                      f("allowedBranchIds", next);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                      isChecked
                        ? isPrimary
                          ? "bg-primary/20 border-primary/50 text-primary cursor-default"
                          : "bg-blue-500/20 border-blue-500/50 text-blue-300"
                        : "border-white/15 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? (isPrimary ? "bg-primary" : "bg-blue-400") : "bg-white/20"}`} />
                    {b.name}
                    {isPrimary && <span className="text-[9px] opacity-60 ml-0.5">{t("hostess_detail.primary_label")}</span>}
                  </button>
                );
              })}
            </div>
            {(merged.allowedBranchIds ?? []).length > 0 && (
              <p className="mt-2 text-xs text-blue-400/70">
                {t("hostess_detail.scheduled_at_n_branches", { n: (merged.allowedBranchIds ?? []).length + 1 })}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ── Tab: Introduction ── */}
      {tab === "intro" && (
        <Card className="p-6 space-y-4">
          {/* Language tabs */}
          <div className="flex gap-0 border border-white/10 rounded-lg overflow-hidden w-fit text-xs">
            {[
              { code: "en", label: "EN" }, { code: "zh-Hans", label: "中文" },
              { code: "ko", label: "한국어" }, { code: "th", label: "ไทย" }, { code: "ms", label: "BM" },
            ].map(l => (
              <button
                key={l.code}
                onClick={() => setIntroLang(l.code)}
                className={`px-4 py-2 font-medium transition-colors ${introLang === l.code ? "bg-primary text-black" : "text-muted-foreground hover:bg-white/5"}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {introLang === "en" ? (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">{t("hostess_detail.intro_en")}</label>
                <span className="text-xs text-muted-foreground">{(merged.introText ?? "").length}/500</span>
              </div>
              <Textarea
                rows={6}
                maxLength={500}
                placeholder={t("hostess_detail.write_intro_en")}
                value={merged.introText ?? ""}
                onChange={e => f("introText", e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">{t("hostess_detail.intro_lang", { lang: introLang })}</label>
                <span className="text-xs text-muted-foreground">
                  {((merged.introTranslations ?? {})[introLang] ?? "").length}/500
                </span>
              </div>
              <Textarea
                rows={6}
                maxLength={500}
                placeholder={t("hostess_detail.write_intro_lang", { lang: introLang })}
                value={(merged.introTranslations ?? {})[introLang] ?? ""}
                onChange={e => f("introTranslations", {
                  ...(merged.introTranslations ?? {}),
                  [introLang]: e.target.value,
                })}
              />
            </div>
          )}

          <div className="pt-2 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-yellow-400"
                checked={merged.isFeatured ?? false}
                onChange={e => f("isFeatured", e.target.checked)}
              />
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-sm">{t("hostess_detail.featured_panel")}</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("hostess_detail.display_order")}</span>
              <Input
                type="number" min={0} className="w-20 h-7 text-xs"
                value={merged.displayOrder ?? 0}
                onChange={e => f("displayOrder", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── Tab: Services ── */}
      {tab === "services" && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("hostess_detail.services_pricing")}</h3>
            <Button size="sm" className="gap-1.5" onClick={() => setNewSvc({ serviceCode: "COMPANION", currencyCode: "MYR", priceUnit: "per_hour", isActive: true, hostessCommissionPct: 60 })}>
              <Plus className="w-3.5 h-3.5" /> {t("hostess_detail.add_service")}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">{t("hostess_detail.col_service")}</th>
                  <th className="text-right py-2 pr-4">{t("hostess_detail.col_price")}</th>
                  <th className="text-left py-2 pr-4">{t("hostess_detail.col_unit")}</th>
                  <th className="text-right py-2 pr-4">{t("hostess_detail.col_duration")}</th>
                  <th className="text-right py-2 pr-4">{t("hostess_detail.col_commission")}</th>
                  <th className="text-center py-2 pr-4">{t("hostess_detail.col_active")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map(svc => (
                  <tr key={svc.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4">
                      <p className="font-medium">{svc.serviceName}</p>
                      <p className="text-xs text-muted-foreground">{svc.serviceCode}</p>
                    </td>
                    <td className="text-right py-2 pr-4 font-mono">{svc.priceAmount.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{svc.priceUnit}</td>
                    <td className="text-right py-2 pr-4 text-xs text-muted-foreground">
                      {svc.durationMinutes ? t("hostess_detail.min_label", { n: svc.durationMinutes }) : "—"}
                    </td>
                    <td className="text-right py-2 pr-4">{svc.hostessCommissionPct ? `${svc.hostessCommissionPct}%` : "—"}</td>
                    <td className="text-center py-2 pr-4">
                      <span className={`inline-block w-2 h-2 rounded-full ${svc.isActive ? "bg-green-400" : "bg-slate-500"}`} />
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300"
                        onClick={() => deleteSvcMut.mutate(svc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">{t("hostess_detail.no_services")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline add service form */}
          {newSvc && (
            <div className="border border-white/15 rounded-lg p-4 space-y-3 bg-white/5">
              <p className="text-sm font-semibold">{t("hostess_detail.new_service")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.service_code")}</label>
                  <Select value={newSvc.serviceCode ?? "COMPANION"} onValueChange={v => setNewSvc(p => ({ ...p, serviceCode: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.service_name")}</label>
                  <Input className="mt-1" value={newSvc.serviceName ?? ""} onChange={e => setNewSvc(p => ({ ...p, serviceName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.col_price")}</label>
                  <Input className="mt-1" type="number" value={newSvc.priceAmount ?? ""} onChange={e => setNewSvc(p => ({ ...p, priceAmount: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.col_unit")}</label>
                  <Select value={newSvc.priceUnit ?? "per_hour"} onValueChange={v => setNewSvc(p => ({ ...p, priceUnit: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.duration_min_label")}</label>
                  <Input className="mt-1" type="number" value={newSvc.durationMinutes ?? ""} onChange={e => setNewSvc(p => ({ ...p, durationMinutes: e.target.value ? parseInt(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("hostess_detail.hostess_commission_pct")}</label>
                  <Input className="mt-1" type="number" min={0} max={100} value={newSvc.hostessCommissionPct ?? ""} onChange={e => setNewSvc(p => ({ ...p, hostessCommissionPct: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => addSvcMut.mutate(newSvc)} disabled={!newSvc.serviceName || !newSvc.priceAmount}>
                  <Check className="w-3.5 h-3.5" /> {t("hostess_detail.save_service")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewSvc(null)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Photos ── */}
      {tab === "photos" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{t("hostess_detail.profile_photos")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("hostess_detail.photos_meta", { n: photos.length })}
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { if (e.target.files?.[0]) uploadMut.mutate(e.target.files[0]); }} />
              <Button
                size="sm" className="gap-1.5"
                disabled={photos.length >= 7 || uploadMut.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadMut.isPending ? t("hostess_detail.uploading") : t("hostess_detail.upload_photo")}
              </Button>
            </div>
          </div>

          {/* Drag-drop zone */}
          <div
            className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/25 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) uploadMut.mutate(file);
            }}
          >
            <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("hostess_detail.drag_drop")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("hostess_detail.file_types")}</p>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden" style={{ paddingTop: "133.3%" }}>
                <img
                  src={photo.url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Photo&background=1a1a2e&color=d4a84b&size=200`; }}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                  {!photo.isPrimary && (
                    <Button size="sm" variant="secondary" className="w-full text-[10px] h-7"
                      onClick={() => setPrimaryMut.mutate(photo.id)}>
                      <Star className="w-3 h-3 mr-1" /> {t("hostess_detail.set_primary")}
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="w-full text-[10px] h-7"
                    onClick={() => deletePhotoMut.mutate(photo.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> {t("hostess_detail.delete")}
                  </Button>
                </div>

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                  {photo.isPrimary && (
                    <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {t("hostess_detail.primary_badge")}
                    </span>
                  )}
                  {photo.isApproved ? (
                    <span className="bg-green-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">✓</span>
                  ) : (
                    <span className="bg-amber-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">{t("hostess_detail.pending")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {photos.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t("hostess_detail.no_photos")}</p>
          )}
        </Card>
      )}

      {/* Floating save */}
      {Object.keys(form).length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="shadow-xl gap-2">
            <Save className="w-4 h-4" />
            {saveMut.isPending ? t("hostess_detail.saving") : t("hostess_detail.save_n_changes", { n: Object.keys(form).length })}
          </Button>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
