import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Handshake,
  Plus,
  X,
  FileText,
  CreditCard,
  ChevronRight,
  Users,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Agent {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  commissionType: string;
  commissionRate: number;
  preferredCurrency: string;
  creditBalance: number;
  isActive: boolean;
  hostessCount: number;
}

interface AgentStatement {
  agentId: string;
  agentName: string;
  period: { from: string; to: string };
  hostesses: Array<{
    staffId: string;
    name: string;
    sessions: number;
    hostessGross: number;
    agentCommissionRate: number;
    agentEarned: number;
  }>;
  totalEarned: number;
  previousBalance: number;
  totalDue: number;
  preferredCurrency: string;
  fxRate: number;
  amountInPreferredCurrency: number;
}

function AgentForm({ onClose, editAgent }: { onClose: () => void; editAgent?: Agent }) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: editAgent?.name ?? "",
    contactPerson: editAgent?.contactPerson ?? "",
    phone: editAgent?.phone ?? "",
    email: editAgent?.email ?? "",
    commissionType: editAgent?.commissionType ?? "pct",
    commissionRate: editAgent?.commissionRate?.toString() ?? "0.30",
    preferredCurrency: editAgent?.preferredCurrency ?? "MYR",
    orgId: ORG_ID,
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editAgent ? `/api/agents/${editAgent.id}` : "/api/agents";
      const method = editAgent ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({ ...form, commissionRate: parseFloat(form.commissionRate) }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  const f = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">{editAgent ? "Edit" : "New"} Agent</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Agency / Agent Name *</label>
            <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Elite Agency" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Contact Person</label>
            <Input value={form.contactPerson} onChange={(e) => f("contactPerson", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone / WhatsApp</label>
            <Input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+60..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <Input value={form.email} onChange={(e) => f("email", e.target.value)} type="email" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Commission Rate</label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={form.commissionRate}
                onChange={(e) => f("commissionRate", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {(parseFloat(form.commissionRate) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Payout Currency</label>
            <Select value={form.preferredCurrency} onValueChange={(v) => f("preferredCurrency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["MYR", "AUD", "CNY", "KRW", "JPY"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
          {save.isPending ? "Saving..." : (editAgent ? "Save Changes" : "Create Agent")}
        </Button>
      </Card>
    </div>
  );
}

function StatementModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { token } = useAuthStore();
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmt, setPayoutAmt] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery({
    queryKey: ["agent-statement", agent.id, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${agent.id}/statement?from=${from}&to=${to}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
  });

  const stmt: AgentStatement | undefined = data?.data;

  const recordPayout = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/agents/${agent.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          amountMyr: parseFloat(payoutAmt),
          periodFrom: from,
          periodTo: to,
          paymentMethod: payoutMethod,
          payoutCurrency: agent.preferredCurrency,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowPayout(false);
      refetch();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="p-6 w-full max-w-2xl space-y-5 my-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl">{agent.name}</h3>
            <p className="text-sm text-muted-foreground">Commission Statement</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Period picker */}
        <div className="flex gap-3 items-center">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-38" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-38" />
          <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>

        {stmt ? (
          <>
            {/* Hostess breakdown */}
            {stmt.hostesses.length > 0 ? (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2">Hostess</th>
                      <th className="px-4 py-2 text-right">Sessions</th>
                      <th className="px-4 py-2 text-right">Gross Fees</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmt.hostesses.map((h) => (
                      <tr key={h.staffId} className="border-t border-white/5">
                        <td className="px-4 py-2.5">{h.name}</td>
                        <td className="px-4 py-2.5 text-right">{h.sessions}</td>
                        <td className="px-4 py-2.5 text-right">RM {h.hostessGross.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {(h.agentCommissionRate * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-400">
                          RM {h.agentEarned.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm bg-black/20 rounded-xl">
                No commissions earned in this period
              </div>
            )}

            {/* Summary */}
            <div className="bg-black/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period Earnings</span>
                <span>RM {stmt.totalEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Balance</span>
                <span>RM {stmt.previousBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-white/10 pt-2">
                <span>Total Due</span>
                <span className="text-primary">RM {stmt.totalDue.toFixed(2)}</span>
              </div>
              {stmt.preferredCurrency !== "MYR" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>In {stmt.preferredCurrency} (rate: {stmt.fxRate.toFixed(4)})</span>
                  <span>{stmt.preferredCurrency} {stmt.amountInPreferredCurrency.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Payout section */}
            {!showPayout ? (
              <Button
                className="w-full gap-2"
                disabled={stmt.totalDue <= 0}
                onClick={() => { setPayoutAmt(stmt.totalDue.toFixed(2)); setShowPayout(true); }}
              >
                <CreditCard className="w-4 h-4" /> Record Payout
              </Button>
            ) : (
              <div className="space-y-3 border border-white/10 rounded-xl p-4">
                <p className="text-sm font-medium">Record Payout</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Amount (MYR)</label>
                    <Input type="number" value={payoutAmt} onChange={(e) => setPayoutAmt(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Method</label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["cash", "bank_transfer", "ewallet"].map((m) => (
                          <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => recordPayout.mutate()}
                    disabled={recordPayout.isPending || !payoutAmt}
                  >
                    {recordPayout.isPending ? "Processing..." : "Confirm Payout"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPayout(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading statement...</div>
        )}
      </Card>
    </div>
  );
}

export default function Agents() {
  const { token } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | undefined>();
  const [stmtAgent, setStmtAgent] = useState<Agent | undefined>();

  const [search, setSearch] = useState("");

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const r = await fetch(`/api/agents?org_id=${ORG_ID}`, { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const allAgents: Agent[] = agentsData?.data ?? [];
  const agents = allAgents.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(s) ||
      (a.contactPerson?.toLowerCase().includes(s) ?? false) ||
      (a.phone?.includes(s) ?? false) ||
      (a.email?.toLowerCase().includes(s) ?? false)
    );
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Agents</h1>
            <p className="text-muted-foreground text-sm mt-1">Talent agencies and hostess recruiters</p>
          </div>
          <Button onClick={() => { setEditAgent(undefined); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Agent
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16">
            <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No agents yet</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>Add First Agent</Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <Card key={a.id} className="p-5 space-y-4 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{a.name}</p>
                    {a.contactPerson && <p className="text-xs text-muted-foreground mt-0.5">{a.contactPerson}</p>}
                  </div>
                  <Badge className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {(a.commissionRate * 100).toFixed(0)}% comm.
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-black/30 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground">Hostesses</p>
                    <p className="font-bold text-lg">{a.hostessCount}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                    <p className={`font-bold text-lg ${a.creditBalance > 0 ? "text-amber-400" : ""}`}>
                      {formatCurrency(a.creditBalance)}
                    </p>
                  </div>
                </div>

                {a.phone && <p className="text-xs text-muted-foreground">📞 {a.phone}</p>}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => setStmtAgent(a)}
                  >
                    <FileText className="w-3.5 h-3.5" /> Statement
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs px-3"
                    onClick={() => { setEditAgent(a); setShowForm(true); }}
                  >
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AgentForm
          editAgent={editAgent}
          onClose={() => { setShowForm(false); setEditAgent(undefined); }}
        />
      )}
      {stmtAgent && (
        <StatementModal agent={stmtAgent} onClose={() => setStmtAgent(undefined)} />
      )}
    </DashboardLayout>
  );
}
