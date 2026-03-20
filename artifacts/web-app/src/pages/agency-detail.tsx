import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Users, Search, Plus, Trash2, Download, AlertCircle,
  BarChart2, Banknote, Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agency {
  id: string; agentCode: string | null; name: string;
  contactPerson: string | null; phone: string | null; email: string | null;
  profileImageUrl: string | null; hostessCount: number;
}

interface HostessContract {
  contractId: string; hostessProfileId: string; staffId: string;
  fullName: string; staffCode: string; branchName: string;
  hostessStatus: string; primaryPhoto: string | null;
  venueCommissionRate: number; agentCommissionRate: number;
  contractStart: string; contractEnd: string | null;
  sessionsCount: number; grossRevenue: number; agentCut: number; hostessEarnings: number;
}

interface AccountSummary {
  agent: { name: string; code: string; profileImageUrl: string | null };
  period: { from: string; to: string };
  summary: {
    totalHostesses: number; totalSessions: number;
    grossRevenue: number; agentTotalCut: number; hostessTotalEarnings: number;
  };
  hostessBreakdown: {
    staffId: string; name: string; photoUrl: string | null;
    sessionsCount: number; grossRevenue: number; agentCut: number;
    hostessEarnings: number; commissionRate: string;
  }[];
}

interface RevenueDetail {
  hostess: { name: string; photoUrl: string | null };
  commissionRate: string;
  period: { from: string; to: string };
  sessions: {
    id: string; sessionDate: string; reservationCode: string | null;
    roomName: string | null; hoursWorked: number; grossAmount: number;
    agentCut: number; hostessEarnings: number; notes: string | null;
  }[];
  totals: { grossRevenue: number; agentCut: number; hostessEarnings: number; sessions: number };
}

interface UnassignedHostess {
  id: string; fullName: string; staffCode: string; branchName: string; primaryPhoto: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function CommissionBar({ venue, agent }: { venue: number; agent: number }) {
  return (
    <div className="group relative">
      <div className="flex h-2 rounded-full overflow-hidden bg-white/10 w-full">
        <div className="bg-green-500" style={{ width: `${venue}%` }} />
        <div className="bg-amber-500" style={{ width: `${agent}%` }} />
      </div>
      <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
        Hostess {venue}% · Agent {agent}%
      </div>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Assign Hostess Modal ─────────────────────────────────────────────────────
function AssignModal({ agencyId, onClose, onSaved }: { agencyId: string; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};

  const [hostessId, setHostessId] = useState("");
  const [venue, setVenue] = useState(60);
  const [agent, setAgent] = useState(40);
  const [contractStart, setContractStart] = useState(new Date().toISOString().slice(0, 10));
  const [contractEnd, setContractEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: unassignedData } = useQuery({
    queryKey: ["unassigned-hostesses"],
    queryFn: () => fetch("/api/agencies/unassigned-hostesses", { headers: authH }).then(r => r.json()),
  });
  const unassigned: UnassignedHostess[] = unassignedData?.data ?? [];

  const syncRates = (v: number) => { setVenue(v); setAgent(100 - v); };

  async function handleSave() {
    if (!hostessId) { toast({ title: "Error", description: "Select a hostess first.", variant: "destructive" }); return; }
    if (Math.abs(venue + agent - 100) > 0.01) { toast({ title: "Error", description: "Rates must sum to 100%.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/agencies/${agencyId}/hostesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          hostessProfileId: hostessId,
          venueCommissionRate: venue, agentCommissionRate: agent,
          contractStart, contractEnd: contractEnd || null,
        }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || "Failed"); }
      toast({ title: "Assigned", description: "Hostess contract created." });
      onSaved(); onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign Hostess to Agency</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Select Hostess</label>
            <Select value={hostessId} onValueChange={setHostessId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose unassigned hostess…" /></SelectTrigger>
              <SelectContent>
                {unassigned.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.fullName} · {h.staffCode} ({h.branchName})</SelectItem>
                ))}
                {unassigned.length === 0 && <SelectItem value="__none__" disabled>No unassigned hostesses</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Commission Split</label>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20">Hostess %</span>
                <input type="range" min={30} max={80} step={1} value={venue}
                  onChange={e => syncRates(parseInt(e.target.value))}
                  className="flex-1 accent-green-500" />
                <span className="text-sm font-mono w-12 text-right text-green-400">{venue}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20">Agent %</span>
                <input type="range" min={20} max={70} step={1} value={agent}
                  onChange={e => { setAgent(parseInt(e.target.value)); setVenue(100 - parseInt(e.target.value)); }}
                  className="flex-1 accent-amber-500" />
                <span className="text-sm font-mono w-12 text-right text-amber-400">{agent}%</span>
              </div>
              <CommissionBar venue={venue} agent={agent} />
              <p className={`text-xs ${Math.abs(venue + agent - 100) > 0.01 ? "text-red-400" : "text-muted-foreground"}`}>
                Total: {venue + agent}% {Math.abs(venue + agent - 100) > 0.01 ? "(must equal 100%)" : "✓"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Contract Start</label>
              <Input className="mt-1" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contract End (optional)</label>
              <Input className="mt-1" type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Contract"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Revenue Detail Modal ──────────────────────────────────────────────────────
function RevenueModal({ agencyId, contractId, contractName, from, to, onClose }: {
  agencyId: string; contractId: string; contractName: string;
  from: string; to: string; onClose: () => void;
}) {
  const { token, user } = useAuthStore();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};
  const isAdmin = ["super_admin", "admin"].includes(user?.role ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-detail", agencyId, contractId, from, to],
    queryFn: () =>
      fetch(`/api/agencies/${agencyId}/hostesses/${contractId}/revenue-detail?from=${from}&to=${to}`, { headers: authH })
        .then(r => r.json()),
    enabled: isAdmin,
  });
  const detail: RevenueDetail | null = data ?? null;

  function exportCsv() {
    if (!detail) return;
    const header = "Date,Room,Hours,Gross (MYR),Agent Cut (MYR),Hostess (MYR),Notes\n";
    const rows = detail.sessions.map(s =>
      `${s.sessionDate},${s.roomName ?? ""},${s.hoursWorked.toFixed(2)},${s.grossAmount.toFixed(2)},${s.agentCut.toFixed(2)},${s.hostessEarnings.toFixed(2)},"${s.notes ?? ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `revenue-${contractName}-${from}-${to}.csv`;
    a.click();
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{contractName} — Revenue Detail ({from} → {to})</DialogTitle>
        </DialogHeader>

        {!isAdmin ? (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Access restricted. Contact Admin for full revenue detail.
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading sessions…</div>
        ) : !detail || detail.sessions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No sessions found for this period.</div>
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-white/10 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Room</th>
                    <th className="text-right py-2 pr-3">Hours</th>
                    <th className="text-right py-2 pr-3">Gross (MYR)</th>
                    <th className="text-right py-2 pr-3">Agent Cut</th>
                    <th className="text-right py-2">Hostess Earn.</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sessions.map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3">{fmtDate(s.sessionDate)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{s.roomName ?? "—"}</td>
                      <td className="text-right py-2 pr-3 font-mono">{s.hoursWorked.toFixed(1)}</td>
                      <td className="text-right py-2 pr-3 font-mono">{s.grossAmount.toFixed(2)}</td>
                      <td className="text-right py-2 pr-3 font-mono text-amber-400">{s.agentCut.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono text-green-400">{s.hostessEarnings.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/20 font-bold">
                    <td colSpan={3} className="py-2 pr-3">TOTAL ({detail.totals.sessions} sessions)</td>
                    <td className="text-right py-2 pr-3 font-mono">{detail.totals.grossRevenue.toFixed(2)}</td>
                    <td className="text-right py-2 pr-3 font-mono text-amber-400">{detail.totals.agentCut.toFixed(2)}</td>
                    <td className="text-right py-2 font-mono text-green-400">{detail.totals.hostessEarnings.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="pt-3 flex justify-end">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────
export default function AgencyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};

  const [tab, setTab] = useState<"hostesses" | "account">("hostesses");

  // Date range state
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);

  const [hostessSearch, setHostessSearch] = useState("");
  const [revenueModal, setRevenueModal] = useState<{ contractId: string; name: string } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  // Fetch agency
  const { data: agencyData } = useQuery({
    queryKey: ["agency", id],
    queryFn: () => fetch(`/api/agencies/${id}`, { headers: authH }).then(r => r.json()),
    enabled: !!id,
  });
  const agency: Agency | null = agencyData?.data ?? null;

  // Fetch hostesses
  const hostessParams = new URLSearchParams({ from: appliedFrom, to: appliedTo });
  if (hostessSearch) hostessParams.set("search", hostessSearch);

  const { data: hostessData, isLoading: hostessLoading } = useQuery({
    queryKey: ["agency-hostesses", id, appliedFrom, appliedTo, hostessSearch],
    queryFn: () => fetch(`/api/agencies/${id}/hostesses?${hostessParams}`, { headers: authH }).then(r => r.json()),
    enabled: !!id,
  });
  const hostesses: HostessContract[] = hostessData?.data ?? [];

  // Fetch account summary
  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ["agency-account", id, appliedFrom, appliedTo],
    queryFn: () => fetch(`/api/agencies/${id}/account-summary?from=${appliedFrom}&to=${appliedTo}`, { headers: authH }).then(r => r.json()),
    enabled: !!id && tab === "account",
  });
  const account: AccountSummary | null = accountData ?? null;

  // Remove contract
  const removeMut = useMutation({
    mutationFn: async (contractId: string) => {
      await fetch(`/api/agencies/${id}/hostesses/${contractId}`, { method: "DELETE", headers: authH });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-hostesses", id] });
      qc.invalidateQueries({ queryKey: ["agency", id] });
    },
    onError: () => toast({ title: "Error", description: "Remove failed.", variant: "destructive" }),
  });

  if (!agency) return (
    <DashboardLayout>
      <div className="p-8 text-muted-foreground">Loading agency…</div>
    </DashboardLayout>
  );

  const avatarUrl = agency.profileImageUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(agency.agentCode ?? agency.name.slice(0, 2))}&size=200&background=1a1a2e&color=d4af37&bold=true`;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1300px] space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/agencies")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Agencies
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
                <img src={avatarUrl} alt={agency.name} className="w-full h-full object-cover"
                  onError={e => (e.target as HTMLImageElement).src = avatarUrl} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{agency.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {agency.agentCode ?? ""} · {agency.contactPerson ?? ""} {agency.phone ? `· ${agency.phone}` : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground border border-white/10 px-2.5 py-1 rounded-full">
              <Users className="w-3 h-3 inline mr-1" />{agency.hostessCount} hostesses
            </span>
          </div>
        </div>

        {/* Date range + tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input type="date" className="w-36 h-8 text-xs" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-muted-foreground text-xs">→</span>
            <Input type="date" className="w-36 h-8 text-xs" value={to} onChange={e => setTo(e.target.value)} />
            <Button size="sm" className="h-8 text-xs" onClick={() => { setAppliedFrom(from); setAppliedTo(to); }}>Apply</Button>
          </div>

          <div className="flex gap-0 border border-white/10 rounded-lg overflow-hidden ml-auto">
            {(["hostesses", "account"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-1.5 text-sm font-medium transition-colors capitalize ${tab === t ? "bg-primary text-black" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
                {t === "hostesses" ? "Hostesses" : "Account"}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: HOSTESSES ── */}
        {tab === "hostesses" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search hostess…" className="pl-9 h-8 text-xs" value={hostessSearch} onChange={e => setHostessSearch(e.target.value)} />
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Assign Hostess
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Hostess</th>
                    <th className="text-center py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4 w-40">Commission Split</th>
                    <th className="text-left py-2 pr-4">Contract Period</th>
                    <th className="text-right py-2 pr-4">Sessions</th>
                    <th className="text-right py-2 pr-4">Revenue (MYR)</th>
                    <th className="text-right py-2 pr-4">Agent Cut</th>
                    <th className="text-center py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hostessLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td colSpan={8} className="py-3"><div className="h-4 bg-white/5 animate-pulse rounded" /></td>
                      </tr>
                    ))
                  ) : hostesses.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No hostesses assigned.</td></tr>
                  ) : hostesses.map(h => (
                    <tr key={h.contractId} className="border-b border-white/5 hover:bg-white/5">
                      {/* Photo + Name */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0">
                            {h.primaryPhoto ? (
                              <img src={h.primaryPhoto} alt="" className="w-full h-full object-cover"
                                onError={e => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(h.fullName)}&background=1a1a2e&color=d4af37&size=64`} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-primary/60">{h.fullName.charAt(0)}</div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-xs">{h.fullName}</p>
                            <p className="text-[10px] text-muted-foreground">{h.staffCode}</p>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="py-2 pr-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${h.hostessStatus === "active" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                          {h.hostessStatus}
                        </span>
                      </td>
                      {/* Commission Split */}
                      <td className="py-2 pr-4">
                        <div className="space-y-1">
                          <p className={`text-xs font-mono ${h.venueCommissionRate >= 60 ? "text-green-400" : "text-amber-400"}`}>
                            {h.venueCommissionRate}% / {h.agentCommissionRate}%
                          </p>
                          <CommissionBar venue={h.venueCommissionRate} agent={h.agentCommissionRate} />
                        </div>
                      </td>
                      {/* Contract Period */}
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {fmtDate(h.contractStart)}{h.contractEnd ? ` → ${fmtDate(h.contractEnd)}` : " → ∞"}
                      </td>
                      {/* Sessions */}
                      <td className="py-2 pr-4 text-right font-mono text-sm">{h.sessionsCount}</td>
                      {/* Revenue */}
                      <td className="py-2 pr-4 text-right font-mono text-sm">{h.grossRevenue.toFixed(2)}</td>
                      {/* Agent Cut */}
                      <td className="py-2 pr-4 text-right font-mono text-sm text-amber-400">{h.agentCut.toFixed(2)}</td>
                      {/* Actions */}
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-white"
                            onClick={() => setRevenueModal({ contractId: h.contractId, name: h.fullName })}>
                            <BarChart2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400/70 hover:text-red-400"
                            onClick={() => { if (confirm(`Remove ${h.fullName} from this agency?`)) removeMut.mutate(h.contractId); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── TAB: ACCOUNT ── */}
        {tab === "account" && (
          <div className="space-y-5">
            {accountLoading ? (
              <div className="h-40 bg-white/5 animate-pulse rounded-xl" />
            ) : !account ? (
              <div className="text-center py-10 text-muted-foreground">No account data.</div>
            ) : (
              <>
                {/* Summary Card */}
                <Card className="p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-base">{account.agent.name} — Account Summary</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Period: {fmtDate(account.period.from)} – {fmtDate(account.period.to)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: "Active Hostesses", value: account.summary.totalHostesses, icon: Users },
                      { label: "Total Sessions", value: account.summary.totalSessions, icon: BarChart2 },
                      { label: "Gross Revenue", value: formatCurrency(account.summary.grossRevenue, "MYR"), icon: Banknote },
                      { label: "Agent Cut", value: formatCurrency(account.summary.agentTotalCut, "MYR"), color: "text-amber-400", icon: Banknote },
                      { label: "Hostess Earn.", value: formatCurrency(account.summary.hostessTotalEarnings, "MYR"), color: "text-green-400", icon: Banknote },
                    ].map(({ label, value, color, icon: Icon }) => (
                      <div key={label} className="bg-white/5 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
                        <p className={`text-base font-bold mt-1 ${color ?? ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Split bar */}
                  {account.summary.grossRevenue > 0 && (
                    <div>
                      <div className="flex text-[10px] text-muted-foreground justify-between mb-1">
                        <span>Hostess {((account.summary.hostessTotalEarnings / account.summary.grossRevenue) * 100).toFixed(1)}%</span>
                        <span>Agent {((account.summary.agentTotalCut / account.summary.grossRevenue) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-white/10 flex">
                        <div className="bg-green-500" style={{ width: `${(account.summary.hostessTotalEarnings / account.summary.grossRevenue) * 100}%` }} />
                        <div className="bg-amber-500 flex-1" />
                      </div>
                    </div>
                  )}
                </Card>

                {/* Per-hostess breakdown */}
                <Card className="p-5">
                  <h3 className="font-semibold text-sm mb-4">Per-Hostess Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4">Hostess</th>
                          <th className="text-right py-2 pr-4">Sessions</th>
                          <th className="text-right py-2 pr-4">Gross (MYR)</th>
                          <th className="text-right py-2 pr-4">Agent Cut</th>
                          <th className="text-right py-2 pr-4">Hostess Earn.</th>
                          <th className="text-center py-2 pr-4">Split</th>
                          <th className="text-center py-2">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.hostessBreakdown.map(h => (
                          <tr key={h.staffId} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-white/5 shrink-0">
                                  {h.photoUrl
                                    ? <img src={h.photoUrl} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-[10px] text-primary/60">{h.name.charAt(0)}</div>
                                  }
                                </div>
                                <span className="text-xs font-medium">{h.name}</span>
                              </div>
                            </td>
                            <td className="text-right py-2 pr-4 font-mono">{h.sessionsCount}</td>
                            <td className="text-right py-2 pr-4 font-mono">{h.grossRevenue.toFixed(2)}</td>
                            <td className="text-right py-2 pr-4 font-mono text-amber-400">{h.agentCut.toFixed(2)}</td>
                            <td className="text-right py-2 pr-4 font-mono text-green-400">{h.hostessEarnings.toFixed(2)}</td>
                            <td className="text-center py-2 pr-4 text-xs font-mono">{h.commissionRate}</td>
                            <td className="text-center py-2">
                              <button
                                onClick={() => setRevenueModal({ contractId: h.staffId, name: h.name })}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                <BarChart2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {account.hostessBreakdown.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No hostesses with sessions in this period.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {assignOpen && (
        <AssignModal agencyId={id!} onClose={() => setAssignOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["agency-hostesses", id] }); qc.invalidateQueries({ queryKey: ["agency", id] }); }} />
      )}
      {revenueModal && (
        <RevenueModal
          agencyId={id!}
          contractId={revenueModal.contractId}
          contractName={revenueModal.name}
          from={appliedFrom} to={appliedTo}
          onClose={() => setRevenueModal(null)}
        />
      )}
    </DashboardLayout>
  );
}
