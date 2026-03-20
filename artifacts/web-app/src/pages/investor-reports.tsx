import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import {
  TrendingUp, BarChart2, Users, Home, PieChart,
  Download, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface InvestorReport {
  id: string;
  period: string;
  branch_name: string | null;
  branch_display_name: string | null;
  report_type: string;
  total_revenue: number;
  room_revenue: number;
  beverage_revenue: number;
  food_revenue: number;
  package_revenue: number;
  other_revenue: number;
  total_commission_expense: number;
  gross_profit: number;
  net_profit: number;
  room_utilization_pct: number;
  total_sessions: number;
  unique_customers: number;
  avg_spend_per_session: number;
  notes: string | null;
  currency_code: string;
  generated_at: string;
}

interface KpiRow {
  period: string;
  total_revenue: number;
  gross_profit: number;
  net_profit: number;
  avg_utilization: number;
  total_sessions: number;
  unique_customers: number;
  avg_spend: number;
}

function KpiCard({ label, value, icon: Icon, accent = false }: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={`p-4 border ${accent ? "bg-primary/10 border-primary/30" : "bg-black/40 border-white/5"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-xl font-display font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}

function ReportRow({ report, onExport }: { report: InvestorReport; onExport: (period: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/8 rounded-xl bg-black/30 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono font-bold text-primary text-sm">{report.period}</span>
          <span className="text-sm font-medium">{report.branch_display_name ?? report.branch_name ?? "All Branches"}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{report.report_type}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-sm font-bold">{formatCurrency(Number(report.total_revenue))}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <p className={`text-sm font-bold ${Number(report.net_profit) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(Number(report.net_profit))}
            </p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/8 p-4 space-y-4">
          {/* Revenue breakdown */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Revenue Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                ["Room",      report.room_revenue],
                ["Beverage",  report.beverage_revenue],
                ["Food",      report.food_revenue],
                ["Package",   report.package_revenue],
                ["Other",     report.other_revenue],
                ["Total",     report.total_revenue],
              ].map(([label, val]) => (
                <div key={label as string} className={`rounded-lg p-2 text-center border ${label === "Total" ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/8"}`}>
                  <p className="text-xs text-muted-foreground mb-0.5">{label as string}</p>
                  <p className={`text-xs font-bold ${label === "Total" ? "text-primary" : ""}`}>{formatCurrency(Number(val))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Profitability */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Profitability</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Gross Profit", report.gross_profit, "text-emerald-400"],
                ["Net Profit",   report.net_profit,   Number(report.net_profit) >= 0 ? "text-emerald-400" : "text-red-400"],
                ["Commission",   report.total_commission_expense, "text-yellow-400"],
                ["Utilization",  null, ""],
              ].map(([label, val, color]) => (
                <div key={label as string} className="rounded-lg p-2 text-center bg-white/5 border border-white/8">
                  <p className="text-xs text-muted-foreground mb-0.5">{label as string}</p>
                  {label === "Utilization" ? (
                    <p className="text-xs font-bold">{Number(report.room_utilization_pct).toFixed(1)}%</p>
                  ) : (
                    <p className={`text-xs font-bold ${color as string}`}>{formatCurrency(Number(val))}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Operational KPIs</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2 text-center bg-white/5 border border-white/8">
                <p className="text-xs text-muted-foreground mb-0.5">Sessions</p>
                <p className="text-xs font-bold">{report.total_sessions}</p>
              </div>
              <div className="rounded-lg p-2 text-center bg-white/5 border border-white/8">
                <p className="text-xs text-muted-foreground mb-0.5">Customers</p>
                <p className="text-xs font-bold">{report.unique_customers}</p>
              </div>
              <div className="rounded-lg p-2 text-center bg-white/5 border border-white/8">
                <p className="text-xs text-muted-foreground mb-0.5">Avg Spend</p>
                <p className="text-xs font-bold">{formatCurrency(Number(report.avg_spend_per_session))}</p>
              </div>
            </div>
          </div>

          {report.notes && (
            <div className="rounded-lg p-3 bg-white/5 border border-white/8 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-wide mb-1">Notes</p>
              <p>{report.notes}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => onExport(report.period)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestorReports() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const [period, setPeriod] = useState("");
  const [showForm, setShowForm] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ["investor-reports", period],
    queryFn: async () => {
      const url = period ? `/api/investor/reports?period=${period}` : "/api/investor/reports";
      const r = await fetch(url);
      if (!r.ok) throw new Error("Failed to load");
      const d = await r.json();
      return (d.data ?? []) as InvestorReport[];
    },
    enabled: !!token,
  });

  const kpisQuery = useQuery({
    queryKey: ["investor-kpis"],
    queryFn: async () => {
      const r = await fetch("/api/investor/kpis");
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data ?? []) as KpiRow[];
    },
    enabled: !!token,
  });

  const exportMutation = useMutation({
    mutationFn: async (p: string) => {
      const r = await fetch(`/api/investor/reports/export/${p}`);
      return r.json();
    },
  });

  const latestKpi = kpisQuery.data?.[0];
  const reports = reportsQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <PieChart className="w-6 h-6 text-primary" /> Investor Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monthly aggregated performance reports — CONFIDENTIAL
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              style={{ colorScheme: "dark" }}
              placeholder="Filter by month"
            />
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-black rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Report
            </button>
          </div>
        </div>

        {/* KPI Summary — latest month */}
        {latestKpi && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total Revenue"    value={formatCurrency(Number(latestKpi.total_revenue))} icon={TrendingUp} accent />
            <KpiCard label="Net Profit"       value={formatCurrency(Number(latestKpi.net_profit))} icon={BarChart2} />
            <KpiCard label="Sessions"         value={String(latestKpi.total_sessions)} icon={Home} />
            <KpiCard label="Unique Customers" value={String(latestKpi.unique_customers)} icon={Users} />
          </div>
        )}

        {/* Report list */}
        {reportsQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center bg-black/40 border-white/5">
            <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">No investor reports found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Use &ldquo;Add Report&rdquo; to create the first monthly report.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <ReportRow
                key={r.id}
                report={r}
                onExport={(p) => exportMutation.mutate(p)}
              />
            ))}
          </div>
        )}

        {/* Add Report Form */}
        {showForm && (
          <AddReportForm
            onSuccess={() => {
              setShowForm(false);
              qc.invalidateQueries({ queryKey: ["investor-reports"] });
              qc.invalidateQueries({ queryKey: ["investor-kpis"] });
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function AddReportForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    branch_id: "",
    branch_name: "",
    total_revenue: "",
    room_revenue: "",
    beverage_revenue: "",
    food_revenue: "",
    gross_profit: "",
    net_profit: "",
    total_commission_expense: "",
    total_operating_cost: "",
    room_utilization_pct: "",
    total_sessions: "",
    unique_customers: "",
    avg_spend_per_session: "",
    notes: "",
    currency_code: "MYR",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const r = await fetch("/api/branches");
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data ?? []) as { id: string; name: string }[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        total_revenue:          Number(form.total_revenue) || 0,
        room_revenue:           Number(form.room_revenue) || 0,
        beverage_revenue:       Number(form.beverage_revenue) || 0,
        food_revenue:           Number(form.food_revenue) || 0,
        gross_profit:           Number(form.gross_profit) || 0,
        net_profit:             Number(form.net_profit) || 0,
        total_commission_expense: Number(form.total_commission_expense) || 0,
        total_operating_cost:   Number(form.total_operating_cost) || 0,
        room_utilization_pct:   Number(form.room_utilization_pct) || 0,
        total_sessions:         Number(form.total_sessions) || 0,
        unique_customers:       Number(form.unique_customers) || 0,
        avg_spend_per_session:  Number(form.avg_spend_per_session) || 0,
        branch_id: form.branch_id || null,
      };
      const r = await fetch("/api/investor/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed to save");
      }
      onSuccess();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "number") => (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        step={type === "number" ? "0.01" : undefined}
      />
    </div>
  );

  return (
    <Card className="p-6 bg-black/50 border-primary/20">
      <h3 className="font-display font-semibold mb-4 text-primary">New Monthly Report</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Period (YYYY-MM)</label>
            <input type="month" value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              style={{ colorScheme: "dark" }} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch</label>
            <select
              value={form.branch_id}
              onChange={e => {
                const b = branches?.find(x => x.id === e.target.value);
                setForm(f => ({ ...f, branch_id: e.target.value, branch_name: b?.name ?? "" }));
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">All Branches</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Currency</label>
            <select value={form.currency_code}
              onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {["MYR","USD","SGD","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground uppercase tracking-wide pt-2">Revenue</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {field("total_revenue", "Total Revenue")}
          {field("room_revenue", "Room Revenue")}
          {field("beverage_revenue", "Beverage Revenue")}
          {field("food_revenue", "Food Revenue")}
          {field("gross_profit", "Gross Profit")}
          {field("net_profit", "Net Profit")}
        </div>

        <p className="text-xs text-muted-foreground uppercase tracking-wide pt-2">Operations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {field("total_operating_cost", "Operating Cost")}
          {field("total_commission_expense", "Commission Expense")}
          {field("room_utilization_pct", "Room Utilization %")}
          {field("total_sessions", "Total Sessions", "number")}
          {field("unique_customers", "Unique Customers", "number")}
          {field("avg_spend_per_session", "Avg Spend / Session")}
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        </div>

        {err && <p className="text-sm text-red-400">⚠ {err}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? "Saving..." : "Save Report"}
          </button>
        </div>
      </form>
    </Card>
  );
}
