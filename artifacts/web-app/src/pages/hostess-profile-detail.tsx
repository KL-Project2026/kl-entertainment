import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  branchId: string; branchName: string; nationality: string | null;
  nationalityCode: string | null; dateOfBirth: string | null;
  heightCm: number | null; weightKg: number | null; bodySize: string | null;
  bustCm: number | null; waistCm: number | null; hipCm: number | null;
  introText: string | null; introTranslations: Record<string, string>;
  languagesSpoken: string[]; status: string; availableToday: boolean;
  displayOrder: number; isFeatured: boolean; age: number | null;
  primaryPhoto: string | null; photoCount: number;
  pdpaConsentGiven: boolean; pdpaConsentDate: string | null;
}

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
      toast({ title: "Saved", description: "Profile updated successfully." });
      qc.invalidateQueries({ queryKey: ["hostess-profile", id] });
      qc.invalidateQueries({ queryKey: ["hostess-profiles"] });
      setForm({});
    },
    onError: () => toast({ title: "Error", description: "Save failed.", variant: "destructive" }),
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
      toast({ title: "Uploaded", description: "Photo uploaded successfully." });
    },
    onError: () => toast({ title: "Error", description: "Upload failed.", variant: "destructive" }),
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
  if (isLoading) return <DashboardLayout><div className="p-8 text-muted-foreground">Loading profile…</div></DashboardLayout>;
  if (!profile) return <DashboardLayout><div className="p-8 text-muted-foreground">Profile not found.</div></DashboardLayout>;

  const countryInfo = COUNTRIES.find(c => c.code === merged.nationalityCode);

  return (
    <DashboardLayout>
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/staff/hostesses")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
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
              {saveMut.isPending ? "Saving…" : "Save Changes"}
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
        <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nationality</p>
            <p className="font-medium">{countryInfo ? `${countryInfo.flag} ${countryInfo.name}` : profile.nationality ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Age / Height</p>
            <p className="font-medium">{merged.age ?? "—"} yr / {merged.heightCm ?? "—"} cm</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Photos</p>
            <p className="font-medium">{profile.photoCount} approved</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PDPA Consent</p>
            <p className={`font-medium ${profile.pdpaConsentGiven ? "text-green-400" : "text-red-400"}`}>
              {profile.pdpaConsentGiven ? "Given" : "Pending"}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-0 border border-white/10 rounded-lg overflow-hidden w-fit">
        {(["basic", "intro", "services", "photos"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-black" : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            {t === "basic" ? "Basic Info" : t === "intro" ? "Introduction" : t === "services" ? "Services" : "Photos"}
          </button>
        ))}
      </div>

      {/* ── Tab: Basic Info ── */}
      {tab === "basic" && (
        <Card className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Nationality */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Nationality</label>
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
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date of birth */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Date of Birth</label>
              <Input
                type="date"
                value={merged.dateOfBirth?.split("T")[0] ?? ""}
                onChange={e => f("dateOfBirth", e.target.value || null)}
              />
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Height (cm)</label>
              <Input type="number" min={140} max={185}
                value={merged.heightCm ?? ""} onChange={e => f("heightCm", e.target.value ? parseInt(e.target.value) : null)} />
            </div>

            {/* Weight */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Weight (kg)</label>
              <Input type="number" step="0.5" min={38} max={90}
                value={merged.weightKg ?? ""} onChange={e => f("weightKg", e.target.value ? parseFloat(e.target.value) : null)} />
            </div>

            {/* Body size */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Body Size</label>
              <Select value={merged.bodySize ?? "__none__"} onValueChange={v => f("bodySize", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {["XS", "S", "M", "L", "XL", "XXL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select value={merged.status} onValueChange={v => f("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bust / Waist / Hip */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Measurements (cm) — Manager View Only</p>
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
            <p className="text-xs text-muted-foreground font-medium mb-2">Languages Spoken</p>
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
              <span className="text-sm">Featured (highlight in selection panel)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-green-400"
                checked={merged.availableToday ?? false}
                onChange={e => f("availableToday", e.target.checked)}
              />
              <span className="text-sm">Available Today</span>
            </label>
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
                <label className="text-xs text-muted-foreground">Introduction (English)</label>
                <span className="text-xs text-muted-foreground">{(merged.introText ?? "").length}/500</span>
              </div>
              <Textarea
                rows={6}
                maxLength={500}
                placeholder="Write a short introduction…"
                value={merged.introText ?? ""}
                onChange={e => f("introText", e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Introduction ({introLang})</label>
                <span className="text-xs text-muted-foreground">
                  {((merged.introTranslations ?? {})[introLang] ?? "").length}/500
                </span>
              </div>
              <Textarea
                rows={6}
                maxLength={500}
                placeholder={`Write introduction in ${introLang}…`}
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
              <span className="text-sm">Featured on selection panel</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Display order:</span>
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
            <h3 className="font-semibold">Services & Pricing</h3>
            <Button size="sm" className="gap-1.5" onClick={() => setNewSvc({ serviceCode: "COMPANION", currencyCode: "MYR", priceUnit: "per_hour", isActive: true, hostessCommissionPct: 60 })}>
              <Plus className="w-3.5 h-3.5" /> Add Service
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4">Service</th>
                  <th className="text-right py-2 pr-4">Price (MYR)</th>
                  <th className="text-left py-2 pr-4">Unit</th>
                  <th className="text-right py-2 pr-4">Duration</th>
                  <th className="text-right py-2 pr-4">Commission %</th>
                  <th className="text-center py-2 pr-4">Active</th>
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
                      {svc.durationMinutes ? `${svc.durationMinutes} min` : "—"}
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
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No services yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline add service form */}
          {newSvc && (
            <div className="border border-white/15 rounded-lg p-4 space-y-3 bg-white/5">
              <p className="text-sm font-semibold">New Service</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Service Code</label>
                  <Select value={newSvc.serviceCode ?? "COMPANION"} onValueChange={v => setNewSvc(p => ({ ...p, serviceCode: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Service Name</label>
                  <Input className="mt-1" value={newSvc.serviceName ?? ""} onChange={e => setNewSvc(p => ({ ...p, serviceName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Price (MYR)</label>
                  <Input className="mt-1" type="number" value={newSvc.priceAmount ?? ""} onChange={e => setNewSvc(p => ({ ...p, priceAmount: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unit</label>
                  <Select value={newSvc.priceUnit ?? "per_hour"} onValueChange={v => setNewSvc(p => ({ ...p, priceUnit: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duration (min, leave blank for unlimited)</label>
                  <Input className="mt-1" type="number" value={newSvc.durationMinutes ?? ""} onChange={e => setNewSvc(p => ({ ...p, durationMinutes: e.target.value ? parseInt(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Hostess Commission %</label>
                  <Input className="mt-1" type="number" min={0} max={100} value={newSvc.hostessCommissionPct ?? ""} onChange={e => setNewSvc(p => ({ ...p, hostessCommissionPct: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => addSvcMut.mutate(newSvc)} disabled={!newSvc.serviceName || !newSvc.priceAmount}>
                  <Check className="w-3.5 h-3.5" /> Save Service
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
              <h3 className="font-semibold">Profile Photos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {photos.length}/7 photos · Recommended: 1200×1600px (3:4) · Max 5MB
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
                {uploadMut.isPending ? "Uploading…" : "Upload Photo"}
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
            <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
            <p className="text-xs text-muted-foreground/60 mt-1">JPEG · PNG · WEBP · Max 5MB</p>
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
                      <Star className="w-3 h-3 mr-1" /> Set Primary
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="w-full text-[10px] h-7"
                    onClick={() => deletePhotoMut.mutate(photo.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                  {photo.isPrimary && (
                    <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                  {photo.isApproved ? (
                    <span className="bg-green-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">✓</span>
                  ) : (
                    <span className="bg-amber-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {photos.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No photos uploaded yet. Minimum 3 required for active status.</p>
          )}
        </Card>
      )}

      {/* Floating save */}
      {Object.keys(form).length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="shadow-xl gap-2">
            <Save className="w-4 h-4" />
            {saveMut.isPending ? "Saving…" : `Save ${Object.keys(form).length} change${Object.keys(form).length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
