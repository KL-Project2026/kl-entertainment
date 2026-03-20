import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Briefcase, Plus, Search, Users, BarChart2, Banknote,
  Phone, Mail, Edit, Trash2, ChevronRight, BadgeCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agency {
  id: string; agentCode: string | null; name: string;
  contactPerson: string | null; phone: string | null; email: string | null;
  profileImageUrl: string | null; address: string | null;
  bankName: string | null; bankAccount: string | null;
  bankAccountName: string | null; bankSwiftCode: string | null;
  bankCountry: string | null; commissionRate: number;
  paymentCycle: string; isActive: boolean; notes: string | null;
  hostessCount: number; mtdSessions: number; mtdRevenue: number; mtdAgentCut: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  MY: "🇲🇾", SG: "🇸🇬", TH: "🇹🇭", KR: "🇰🇷", JP: "🇯🇵", CN: "🇨🇳", OTHER: "🌏",
};

// ─── Agency Card ──────────────────────────────────────────────────────────────
function AgencyCard({ agency, onEdit, onDelete }: { agency: Agency; onEdit: (a: Agency) => void; onDelete: (id: string) => void }) {
  const avatarUrl = agency.profileImageUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(agency.agentCode ?? agency.name.slice(0,2))}&size=200&background=1a1a2e&color=d4af37&bold=true`;

  const flag = agency.bankCountry ? (COUNTRY_FLAGS[agency.bankCountry.trim()] ?? "🌏") : "🌏";

  return (
    <Card className="p-5 flex flex-col gap-4 hover:border-white/20 transition-all">
      {/* Header: logo + name */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-white/5 border border-white/10">
          <img src={avatarUrl} alt={agency.name} className="w-full h-full object-cover"
            onError={e => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(agency.name.slice(0,2))}&size=200&background=1a1a2e&color=d4af37&bold=true`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate">{agency.name}</p>
            {agency.isActive
              ? <BadgeCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <span className="text-[10px] text-slate-400 border border-slate-600 px-1 rounded">Inactive</span>
            }
          </div>
          {agency.agentCode && <p className="text-xs text-primary font-mono">{agency.agentCode}</p>}
          {agency.contactPerson && <p className="text-xs text-muted-foreground truncate">{agency.contactPerson}</p>}
        </div>
      </div>

      {/* Contact */}
      {(agency.phone || agency.email) && (
        <div className="space-y-1">
          {agency.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" /> {agency.phone}
            </div>
          )}
          {agency.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" /> <span className="truncate">{agency.email}</span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/8" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold">{agency.hostessCount}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Users className="w-2.5 h-2.5" /> Hostesses
          </p>
        </div>
        <div>
          <p className="text-base font-bold">{agency.mtdSessions}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <BarChart2 className="w-2.5 h-2.5" /> Sessions MTD
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-primary">{formatCurrency(agency.mtdAgentCut, "MYR")}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Banknote className="w-2.5 h-2.5" /> Cut MTD
          </p>
        </div>
      </div>

      {/* Commission rate bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Commission Rate: {(agency.commissionRate * 100).toFixed(0)}%</span>
          <span>{flag} {agency.bankCountry ?? "MY"}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${agency.commissionRate * 100}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Link href={`/agencies/${agency.id}`} className="flex-1">
          <Button size="sm" variant="outline" className="w-full text-xs gap-1">
            <ChevronRight className="w-3.5 h-3.5" /> View Detail
          </Button>
        </Link>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onEdit(agency)}>
          <Edit className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="text-red-400/70 hover:text-red-400" onClick={() => onDelete(agency.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}

// ─── Agent Modal ──────────────────────────────────────────────────────────────
const BLANK: Partial<Agency> = { isActive: true, bankCountry: "MY", commissionRate: 0.4 };

function AgencyModal({
  open, onClose, initial, onSaved,
}: { open: boolean; onClose: () => void; initial?: Agency; onSaved: () => void }) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};
  const [form, setForm] = useState<Partial<Agency>>(initial ?? BLANK);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(initial?.profileImageUrl ?? "");

  const f = (k: keyof Agency, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.name) { toast({ title: "Error", description: "Company name is required.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = initial ? `/api/agencies/${initial.id}` : "/api/agencies";
      const method = initial ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          name: form.name, agentCode: form.agentCode, contactPerson: form.contactPerson,
          phone: form.phone, email: form.email, address: form.address, notes: form.notes,
          isActive: form.isActive,
          bankName: form.bankName, bankAccount: form.bankAccount,
          bankAccountName: form.bankAccountName, bankSwiftCode: form.bankSwiftCode,
          bankCountry: form.bankCountry, commissionRate: form.commissionRate,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Save failed");

      // Upload image if changed
      if (imgRef.current?.files?.[0] && json.data?.id) {
        const fd = new FormData();
        fd.append("image", imgRef.current.files[0]);
        await fetch(`/api/agencies/${json.data.id}/upload-image`, { method: "POST", headers: authH, body: fd });
      }

      toast({ title: initial ? "Updated" : "Created", description: `${form.name} saved successfully.` });
      onSaved(); onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Agency" : "Add New Agency"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Profile Section */}
          <div>
            <p className="text-sm font-semibold text-primary mb-3">Profile</p>
            <div className="flex items-start gap-4">
              {/* Avatar preview */}
              <button
                className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border border-white/15 flex items-center justify-center hover:border-primary/50 transition-colors shrink-0"
                onClick={() => imgRef.current?.click()}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary/40">
                    {form.name?.slice(0, 2).toUpperCase() || "?"}
                  </span>
                )}
              </button>
              <input ref={imgRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setPreviewUrl(URL.createObjectURL(f));
                }} />
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Company Name *</label>
                  <Input className="mt-1" value={form.name ?? ""} onChange={e => f("name", e.target.value)} placeholder="e.g. Seoul Star Agency" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Agent Code</label>
                  <Input className="mt-1" value={form.agentCode ?? ""} onChange={e => f("agentCode", e.target.value)} placeholder="AGT-001" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={form.isActive ? "active" : "inactive"} onValueChange={v => f("isActive", v === "active")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Contact Person</label>
              <Input className="mt-1" value={form.contactPerson ?? ""} onChange={e => f("contactPerson", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input className="mt-1" value={form.phone ?? ""} onChange={e => f("phone", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input className="mt-1" type="email" value={form.email ?? ""} onChange={e => f("email", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Commission Rate (%)</label>
              <Input className="mt-1" type="number" min={0} max={100} step={1}
                value={form.commissionRate !== undefined ? Math.round(form.commissionRate * 100) : ""}
                onChange={e => f("commissionRate", parseFloat(e.target.value) / 100)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Textarea className="mt-1" rows={2} value={form.address ?? ""} onChange={e => f("address", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea className="mt-1" rows={2} value={form.notes ?? ""} onChange={e => f("notes", e.target.value)} />
            </div>
          </div>

          {/* Bank Section */}
          <div>
            <p className="text-sm font-semibold text-primary mb-3">Bank Information (결제 정보)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Bank Name *</label>
                <Input className="mt-1" value={form.bankName ?? ""} onChange={e => f("bankName", e.target.value)} placeholder="e.g. Maybank" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Account Number *</label>
                <Input className="mt-1" value={form.bankAccount ?? ""} onChange={e => f("bankAccount", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Account Holder Name *</label>
                <Input className="mt-1" value={form.bankAccountName ?? ""} onChange={e => f("bankAccountName", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">SWIFT / BIC Code</label>
                <Input className="mt-1" value={form.bankSwiftCode ?? ""} onChange={e => f("bankSwiftCode", e.target.value)} placeholder="MBBEMYKL" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Country</label>
                <Select value={form.bankCountry?.trim() ?? "MY"} onValueChange={v => f("bankCountry", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["MY", "SG", "TH", "KR", "JP", "CN", "OTHER"].map(c => (
                      <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : initial ? "Save Changes" : "Create Agency"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgencyManagement() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("__all__");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agency | undefined>();

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (activeFilter !== "__all__") params.set("active", activeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["agencies", search, activeFilter],
    queryFn: () => fetch(`/api/agencies?${params}`, { headers: authH }).then(r => r.json()),
  });
  const agencies: Agency[] = data?.data ?? [];

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/agencies/${id}`, { method: "DELETE", headers: authH });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agencies"] }),
    onError: () => toast({ title: "Error", description: "Delete failed.", variant: "destructive" }),
  });

  const active = agencies.filter(a => a.isActive).length;
  const totalHostesses = agencies.reduce((s, a) => s + a.hostessCount, 0);
  const totalMtdCut = agencies.reduce((s, a) => s + a.mtdAgentCut, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Briefcase className="w-6 h-6" /> Agencies Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">에이전시 및 호스티스 커미션 관리</p>
          </div>
          <Button className="gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true); }}>
            <Plus className="w-4 h-4" /> Add Agency
          </Button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Agencies", value: agencies.length, icon: Briefcase },
            { label: "Active", value: active, icon: BadgeCheck },
            { label: "Total Hostesses", value: totalHostesses, icon: Users },
            { label: "MTD Agent Cut", value: formatCurrency(totalMtdCut, "MYR"), icon: Banknote },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name or code…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-3">🤝</p>
            <p>No agencies found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agencies.map(a => (
              <AgencyCard
                key={a.id}
                agency={a}
                onEdit={target => { setEditTarget(target); setModalOpen(true); }}
                onDelete={id => {
                  if (confirm("Deactivate this agency?")) deleteMut.mutate(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AgencyModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          initial={editTarget}
          onSaved={() => qc.invalidateQueries({ queryKey: ["agencies"] })}
        />
      )}
    </DashboardLayout>
  );
}
