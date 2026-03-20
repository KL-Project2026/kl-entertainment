import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Star, Edit, ToggleLeft, ToggleRight, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────
interface HostessProfile {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  branchId: string;
  branchName: string;
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
}

interface Branch { id: string; name: string; internalCode: string; }

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

// ─── Hostess Card ─────────────────────────────────────────────────
function HostessCard({
  profile,
  onToggleAvailability,
}: {
  profile: HostessProfile;
  onToggleAvailability: (id: string, val: boolean) => void;
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

        {/* Services price */}
        {profile.minServicePrice !== null && (
          <p className="text-xs text-primary/80">
            Services from <strong>MYR {profile.minServicePrice.toFixed(0)}/hr</strong>
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto pt-1">
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
            />
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
