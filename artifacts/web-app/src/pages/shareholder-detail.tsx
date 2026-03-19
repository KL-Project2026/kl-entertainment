import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Percent, FileText, Edit2, X, Save } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const SETTLEMENT_STATUS_COLORS: Record<string, string> = {
  draft:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  pending:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  approved:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paid:      "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

function DetailRow({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function ShareholderDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: shareholder, isLoading, error } = useQuery({
    queryKey: ["shareholder", id],
    queryFn: async () => {
      const r = await fetch(`/api/shareholders/${id}?org_id=${ORG_ID}`);
      if (!r.ok) throw new Error("Not found");
      return (await r.json()).data;
    },
    enabled: !!id,
  });

  const { data: settlements } = useQuery({
    queryKey: ["shareholder-settlements", id],
    queryFn: async () => {
      const r = await fetch(`/api/shareholders/${id}/settlements?org_id=${ORG_ID}`);
      if (!r.ok) return [];
      return (await r.json()).data ?? [];
    },
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shareholder", id] });

  const updateMut = useMutation({
    mutationFn: () =>
      fetch(`/api/shareholders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, orgId: ORG_ID }),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const startEditing = () => {
    if (!shareholder) return;
    setEditForm({
      name: shareholder.name ?? "",
      email: shareholder.email ?? "",
      phone: shareholder.phone ?? "",
      nationality: shareholder.nationality ?? "",
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

  if (error || !shareholder) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>Shareholder not found.</p>
          <Button variant="ghost" onClick={() => navigate("/shareholders")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Shareholders
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const equityList: Array<Record<string, unknown>> = shareholder.equityStakes ?? [];
  const totalEquity = equityList.reduce((sum: number, e) => sum + parseFloat(String(e.equityPct ?? 0)), 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/shareholders")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold">{shareholder.name}</h1>
                <Badge className={`border text-xs ${shareholder.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                  {shareholder.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {shareholder.nationality && (
                <p className="text-sm text-muted-foreground mt-0.5">{shareholder.nationality}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Profile
            </h3>
            {editing ? (
              <div className="space-y-3">
                {[
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "nationality", label: "Nationality" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                    <Input value={editForm[f.key]} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <DetailRow label="Email" value={shareholder.email} />
                <DetailRow label="Phone" value={shareholder.phone} />
                <DetailRow label="Nationality" value={shareholder.nationality} />
                <DetailRow label="ID / Passport" value={shareholder.idNumber} />
                <DetailRow label="Bank Account" value={shareholder.bankAccount} />
                <DetailRow label="Bank Name" value={shareholder.bankName} />
              </>
            )}
          </Card>

          {/* Equity */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" /> Equity Stakes
            </h3>
            {equityList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No equity stakes recorded</p>
            ) : (
              equityList.map((e, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-sm">{String(e.branchName ?? e.branchId ?? "—")}</span>
                  <span className="font-display font-bold text-primary">
                    {parseFloat(String(e.equityPct)).toFixed(2)}%
                  </span>
                </div>
              ))
            )}
            {equityList.length > 1 && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display font-bold">{totalEquity.toFixed(2)}%</span>
              </div>
            )}
          </Card>
        </div>

        {/* Settlements */}
        {settlements && settlements.length > 0 && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Settlement History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4">Branch</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s: Record<string, string>) => (
                    <tr key={s.id} className="border-b border-white/5 text-sm">
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                      </td>
                      <td className="py-2.5 pr-4">{s.branchName}</td>
                      <td className="py-2.5 pr-4 font-medium">{formatCurrency(parseFloat(s.settlementAmountMyr))}</td>
                      <td className="py-2.5">
                        <Badge className={`text-xs border ${SETTLEMENT_STATUS_COLORS[s.status] ?? "bg-white/10 border-white/20"}`}>
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
