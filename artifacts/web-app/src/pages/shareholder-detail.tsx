import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          <p>{t("shareholder_detail.not_found")}</p>
          <Button variant="ghost" onClick={() => navigate("/shareholders")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> {t("shareholder_detail.back_to_shareholders")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const equityList: Array<Record<string, unknown>> = shareholder.branch_equities ?? [];
  const totalEquity = equityList.reduce((sum: number, e) => sum + parseFloat(String(e.equityPct ?? 0)), 0);
  const totalInvestment = equityList.reduce((sum: number, e) => sum + parseFloat(String(e.investmentAmount ?? 0)), 0);

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
                  {shareholder.isActive ? t("common_extra.active") : t("common_extra.inactive")}
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
                <Edit2 className="w-3.5 h-3.5" /> {t("common.edit")}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? t("shareholder_detail.saving") : t("common.save")}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> {t("shareholder_detail.profile")}
            </h3>
            {editing ? (
              <div className="space-y-3">
                {[
                  { key: "name", label: t("shareholder_detail.name") },
                  { key: "email", label: t("shareholder_detail.email") },
                  { key: "phone", label: t("shareholder_detail.phone") },
                  { key: "nationality", label: t("shareholder_detail.nationality") },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                    <Input value={editForm[f.key]} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <DetailRow label={t("shareholder_detail.email")} value={shareholder.email} />
                <DetailRow label={t("shareholder_detail.phone")} value={shareholder.phone} />
                <DetailRow label={t("shareholder_detail.nationality")} value={shareholder.nationality} />
                <DetailRow label={t("shareholder_detail.id_passport")} value={shareholder.idNumber} />
                <DetailRow label={t("shareholder_detail.bank_account")} value={shareholder.bankAccount} />
                <DetailRow label={t("shareholder_detail.bank_name")} value={shareholder.bankName} />
              </>
            )}
          </Card>

          {/* Equity & Investment */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" /> {t("shareholder_detail.equity_investment")}
            </h3>
            {equityList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("shareholder_detail.no_equity")}</p>
            ) : (
              <>
                {equityList.map((e, i) => {
                  const eqPct = (parseFloat(String(e.equityPct ?? 0)) * 100).toFixed(1);
                  const ratePct = e.agreedRate ? (parseFloat(String(e.agreedRate)) * 100).toFixed(1) : null;
                  const investment = parseFloat(String(e.investmentAmount ?? 0));
                  return (
                    <div key={i} className="py-3 border-b border-white/5 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">{String(e.branchName ?? e.branchId ?? "—")}</span>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="font-display font-bold text-primary text-base">{eqPct}%</span>
                            {ratePct && ratePct !== eqPct && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                {t("shareholder_detail.pct_rate", { pct: ratePct })}
                              </span>
                            )}
                          </div>
                          {investment > 0 && (
                            <span className="text-xs text-emerald-400 font-medium">
                              {t("shareholder_detail.rm_invested", { amount: investment.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {equityList.length > 1 && (
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                    <div>
                      <span className="text-sm text-muted-foreground">{t("shareholder_detail.total_equity")}</span>
                      {totalInvestment > 0 && (
                        <p className="text-xs text-emerald-400 font-medium">
                          {t("shareholder_detail.total_invested", { amount: totalInvestment.toLocaleString("en-MY", { minimumFractionDigits: 2 }) })}
                        </p>
                      )}
                    </div>
                    <span className="font-display font-bold text-lg">{(totalEquity * 100).toFixed(1)}%</span>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Settlements */}
        {settlements && settlements.length > 0 && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> {t("shareholder_detail.settlement_history")}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-4">{t("shareholder_detail.col_period")}</th>
                    <th className="pb-2 pr-4">{t("shareholder_detail.col_branch")}</th>
                    <th className="pb-2 pr-4">{t("shareholder_detail.col_amount")}</th>
                    <th className="pb-2">{t("shareholder_detail.col_status")}</th>
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
