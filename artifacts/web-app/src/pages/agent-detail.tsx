import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Handshake, Users, CreditCard, Edit2, X, Save } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { AgentAccountTab } from "@/components/shared/AccountTab";

function DetailRow({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("info");

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${id}`);
      if (!r.ok) throw new Error("Not found");
      return (await r.json()).data;
    },
    enabled: !!id,
  });

  const { data: hostesses } = useQuery({
    queryKey: ["agent-hostesses", id],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${id}/hostesses`);
      if (!r.ok) return [];
      return (await r.json()).data ?? [];
    },
    enabled: !!id,
  });

  const { data: payouts } = useQuery({
    queryKey: ["agent-payouts", id],
    queryFn: async () => {
      const r = await fetch(`/api/agents/${id}/payouts`);
      if (!r.ok) return [];
      return (await r.json()).data ?? [];
    },
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["agent", id] });

  const updateMut = useMutation({
    mutationFn: () =>
      fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const startEditing = () => {
    if (!agent) return;
    setEditForm({
      name: agent.name ?? "",
      contactPerson: agent.contactPerson ?? "",
      phone: agent.phone ?? "",
      email: agent.email ?? "",
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-white/5 rounded" />
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !agent) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>Agent not found.</p>
          <Button variant="ghost" onClick={() => navigate("/agents")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Agents
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/agents")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold">{agent.name}</h1>
                <Badge className={`border text-xs ${agent.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {agent.contactPerson && (
                <p className="text-sm text-muted-foreground mt-0.5">Contact: {agent.contactPerson}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 24, flexWrap: "wrap" }}>
          {([ ["info", "기본 정보"], ["account", "Account"] ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: "10px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === key ? "#D1AE38" : "transparent"}`,
              marginBottom: -2, fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? "#D1AE38" : "#6b7280",
              cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {activeTab === "info" && (<div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent Info */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Handshake className="w-4 h-4 text-primary" /> Agent Info
            </h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Agency Name</label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Contact Person</label>
                  <Input value={editForm.contactPerson} onChange={e => setEditForm(f => ({ ...f, contactPerson: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Email</label>
                  <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Contact Person" value={agent.contactPerson} />
                <DetailRow label="Phone" value={agent.phone} />
                <DetailRow label="Email" value={agent.email} />
                <DetailRow label="Commission Type" value={agent.commissionType} />
                <DetailRow label="Commission Rate" value={`${(agent.commissionRate * 100).toFixed(0)}%`} />
                <DetailRow label="Preferred Currency" value={agent.preferredCurrency} />
              </>
            )}
          </Card>

          {/* Balance */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Balance & Stats
            </h3>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
              <p className={`text-3xl font-display font-bold ${agent.creditBalance > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                {formatCurrency(agent.creditBalance)}
              </p>
            </div>
            <DetailRow label="Active Hostesses" value={agent.hostessCount ?? (hostesses?.length ?? "—")} />

            {/* Recent Payouts */}
            {payouts && payouts.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Recent Payouts</p>
                {payouts.slice(0, 3).map((p: Record<string, string>) => (
                  <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 text-sm">
                    <span className="text-muted-foreground">{formatDate(p.paidAt)}</span>
                    <span className="font-medium">{formatCurrency(parseFloat(p.amountMyr))}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Hostesses */}
        {hostesses && hostesses.length > 0 && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Assigned Hostesses ({hostesses.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {hostesses.map((h: Record<string, string>) => (
                <div key={h.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-sm">
                    {h.fullName?.charAt(0) ?? "H"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{h.fullName}</p>
                    {h.isActive === "false" && <p className="text-xs text-red-400">Inactive</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        </div>)}

        {activeTab === "account" && (
          <AgentAccountTab agentId={id!} />
        )}
      </div>
    </DashboardLayout>
  );
}
