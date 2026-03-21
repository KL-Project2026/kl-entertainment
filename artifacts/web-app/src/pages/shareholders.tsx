import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
  Users,
  Plus,
  X,
  Percent,
  DollarSign,
  Building2,
  TrendingUp,
} from "lucide-react";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface BranchEquity {
  branchId: string;
  branchName: string;
  equityPct: string;
  agreedRate: string | null;
  investmentAmount: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface Shareholder {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  bankName: string | null;
  bankAccount: string | null;
  swiftCode: string | null;
  preferredCurrency: string;
  isActive: boolean;
  notes: string | null;
  branch_equities: BranchEquity[];
}

interface Branch {
  id: string;
  name: string;
  internalCode: string;
}

interface SettlementCalc {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  equityPctSnapshot: number;
  settlementAmountMyr: number;
  payoutCurrency: string;
  fxRate: number;
  settlementAmountFx: number;
  revenueBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
}

function ShareholderForm({ onClose, editItem }: { onClose: () => void; editItem?: Shareholder }) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: editItem?.name ?? "",
    email: editItem?.email ?? "",
    phone: editItem?.phone ?? "",
    nationality: editItem?.nationality ?? "",
    bankName: editItem?.bankName ?? "",
    bankAccount: editItem?.bankAccount ?? "",
    swiftCode: editItem?.swiftCode ?? "",
    preferredCurrency: editItem?.preferredCurrency ?? "MYR",
    notes: editItem?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editItem ? `/api/shareholders/${editItem.id}` : "/api/shareholders";
      const method = editItem ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({ ...form, orgId: ORG_ID }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholders"] });
      onClose();
    },
  });

  const f = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="p-6 w-full max-w-lg space-y-4 my-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">{editItem ? "Edit" : "New"} Shareholder</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Full Name / Entity *</label>
            <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="John Doe" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <Input value={form.email} onChange={(e) => f("email", e.target.value)} type="email" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone</label>
            <Input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+60..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Nationality</label>
            <Input value={form.nationality} onChange={(e) => f("nationality", e.target.value)} placeholder="Malaysian" />
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
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Bank Name</label>
            <Input value={form.bankName} onChange={(e) => f("bankName", e.target.value)} placeholder="Maybank" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Account Number</label>
            <Input value={form.bankAccount} onChange={(e) => f("bankAccount", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">SWIFT Code</label>
            <Input value={form.swiftCode} onChange={(e) => f("swiftCode", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <Input value={form.notes} onChange={(e) => f("notes", e.target.value)} />
          </div>
        </div>

        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
          {save.isPending ? "Saving..." : (editItem ? "Save Changes" : "Create Shareholder")}
        </Button>
      </Card>
    </div>
  );
}

function EquityForm({ shareholder, branches, onClose }: {
  shareholder: Shareholder;
  branches: Branch[];
  onClose: () => void;
}) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const existingEquity = (equityTarget: Shareholder, bid: string) =>
    equityTarget.branch_equities.find((e) => e.branchId === bid);

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [equityPct, setEquityPct] = useState("0.30");
  const [agreedRate, setAgreedRate] = useState("0.30");
  const [investmentAmount, setInvestmentAmount] = useState("0");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);

  const onBranchChange = (bid: string) => {
    setBranchId(bid);
    const eq = existingEquity(shareholder, bid);
    if (eq) {
      setEquityPct(eq.equityPct ?? "0.30");
      setAgreedRate(eq.agreedRate ?? eq.equityPct ?? "0.30");
      setInvestmentAmount(eq.investmentAmount ?? "0");
      setEffectiveFrom(eq.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().split("T")[0]);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/shareholders/${shareholder.id}/equity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          branchId,
          equityPct: parseFloat(equityPct),
          agreedRate: parseFloat(agreedRate),
          investmentAmount: parseFloat(investmentAmount),
          effectiveFrom,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholders"] });
      onClose();
    },
  });

  const eqDisplay = (val: string) => `${(parseFloat(val || "0") * 100).toFixed(1)}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="p-6 w-[26rem] space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Set Branch Investment — {shareholder.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch</label>
            <Select value={branchId} onValueChange={onBranchChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Equity % <span className="text-primary">({eqDisplay(equityPct)})</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={equityPct}
                  onChange={(e) => setEquityPct(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Enter 0–1 (e.g. 0.30 = 30%)</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Profit Rate <span className="text-primary">({eqDisplay(agreedRate)})</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={agreedRate}
                  onChange={(e) => setAgreedRate(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Agreed payout rate</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Investment Amount (MYR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RM</span>
              <Input
                type="number"
                step="1000"
                min="0"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Effective From</label>
            <DateInput value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
        </div>
        {save.error && <p className="text-xs text-red-400">{String(save.error)}</p>}
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving..." : "Save Investment & Equity"}
        </Button>
      </Card>
    </div>
  );
}

function SettlementModal({ shareholder, branches, onClose }: {
  shareholder: Shareholder;
  branches: Branch[];
  onClose: () => void;
}) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [result, setResult] = useState<SettlementCalc & { id?: string } | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/shareholders/${shareholder.id}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({ branchId, periodStart, periodEnd }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data.data);
      queryClient.invalidateQueries({ queryKey: ["settlements", shareholder.id] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="p-6 w-full max-w-xl space-y-5 my-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xl">Generate Settlement — {shareholder.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Branch</label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Period Start</label>
                <DateInput value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Period End</label>
                <DateInput value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            {generate.error && (
              <p className="text-red-400 text-sm">{String(generate.error)}</p>
            )}
            <Button className="w-full" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? "Calculating..." : "Calculate Settlement"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Card className="p-3 bg-black/30">
                <p className="text-xs text-muted-foreground">Gross Revenue</p>
                <p className="font-bold text-lg">RM {result.grossRevenue.toFixed(2)}</p>
              </Card>
              <Card className="p-3 bg-black/30">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="font-bold text-lg text-red-400">-RM {result.totalExpenses.toFixed(2)}</p>
              </Card>
              <Card className="p-3 bg-black/30">
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className={`font-bold text-lg ${result.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  RM {result.netProfit.toFixed(2)}
                </p>
              </Card>
              <Card className="p-3 bg-black/30">
                <p className="text-xs text-muted-foreground">Equity Stake</p>
                <p className="font-bold text-lg">{(result.equityPctSnapshot * 100).toFixed(1)}%</p>
              </Card>
            </div>

            <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 text-center">
              <p className="text-sm text-muted-foreground">Settlement Amount</p>
              <p className="text-4xl font-bold text-primary">RM {result.settlementAmountMyr.toFixed(2)}</p>
              {shareholder.preferredCurrency !== "MYR" && (
                <p className="text-sm text-muted-foreground mt-2">
                  ≈ {shareholder.preferredCurrency} {result.settlementAmountFx.toFixed(2)}
                  <span className="ml-2 opacity-60">(rate: {result.fxRate.toFixed(4)})</span>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {result.id && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`/api/investor/settlements/${result.id}/pdf`, "_blank")}
                >
                  <FileText className="w-4 h-4 mr-2" /> Download PDF
                </Button>
              )}
              <Button variant="outline" onClick={() => setResult(null)}>New Calculation</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

type ShareholderRow = Record<string, unknown>;

function ShareholderCard({
  shareholder,
  onEquity,
  onSettle,
  onEdit,
}: {
  shareholder: Shareholder;
  onEquity: () => void;
  onSettle: () => void;
  onEdit: () => void;
}) {
  const equities = shareholder.branch_equities ?? [];
  const totalInvested = equities.reduce(
    (sum, e) => sum + parseFloat(e.investmentAmount ?? "0"),
    0
  );
  const totalEquityPct = equities.reduce(
    (sum, e) => sum + parseFloat(e.equityPct ?? "0"),
    0
  );

  return (
    <Card className="overflow-hidden border-white/8 bg-black/40">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-base leading-tight">{shareholder.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium tracking-wide">
              {shareholder.preferredCurrency}
            </span>
          </div>
          <div className="flex gap-4 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {shareholder.email && <span>✉ {shareholder.email}</span>}
            {shareholder.phone && <span>📞 {shareholder.phone}</span>}
            {shareholder.nationality && <span>🌏 {shareholder.nationality}</span>}
          </div>
        </div>

        <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="text-xs gap-1 h-7 px-2.5" onClick={onEquity}>
            <Percent className="w-3 h-3" /> Equity
          </Button>
          <Button size="sm" className="text-xs gap-1 h-7 px-2.5" onClick={onSettle}>
            <DollarSign className="w-3 h-3" /> Settle
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      {/* ── Branch Investments Table ── */}
      {equities.length > 0 && (
        <div className="border-t border-white/5 bg-black/20">
          {/* Column headers */}
          <div className="px-5 py-1.5 grid grid-cols-[1fr_56px_72px_96px] gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-wider border-b border-white/5">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Branch
            </span>
            <span className="text-right">Equity</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Invested</span>
          </div>
          <div className="px-5 divide-y divide-white/5">
            {equities.map((eq) => {
              const eqPct = (parseFloat(eq.equityPct) * 100).toFixed(1);
              const ratePct = eq.agreedRate
                ? (parseFloat(eq.agreedRate) * 100).toFixed(1)
                : eqPct;
              const investment = parseFloat(eq.investmentAmount ?? "0");
              const ratesDiffer = ratePct !== eqPct;
              return (
                <div
                  key={eq.branchId}
                  className="py-2 grid grid-cols-[1fr_56px_72px_96px] gap-2 items-center text-xs"
                >
                  <span className="text-muted-foreground truncate">{eq.branchName}</span>
                  <span className="text-primary font-bold text-right">{eqPct}%</span>
                  <span className={`text-right font-medium ${ratesDiffer ? "text-amber-400" : "text-muted-foreground/50"}`}>
                    {ratePct}%
                  </span>
                  <span className="text-right font-medium text-emerald-400">
                    {investment > 0
                      ? `RM ${investment.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totals footer */}
          <div className="px-5 py-2 grid grid-cols-[1fr_56px_72px_96px] gap-2 items-center border-t border-white/10 bg-white/2">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Total ({equities.length} branch{equities.length !== 1 ? "es" : ""})
            </span>
            <span className="text-primary font-bold text-right text-xs">
              {(totalEquityPct * 100).toFixed(1)}%
            </span>
            <span className="text-right" />
            <span className="text-right text-xs font-bold text-emerald-400">
              {totalInvested > 0
                ? `RM ${totalInvested.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`
                : "—"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

const SHAREHOLDER_COLUMNS: ColumnDef<ShareholderRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (row) => <p className="font-bold">{row.name as string}</p>,
  },
  {
    key: "email",
    label: "Email",
    render: (row) => <span>{(row.email as string) || "—"}</span>,
  },
  {
    key: "phone",
    label: "Phone",
    render: (row) => <span>{(row.phone as string) || "—"}</span>,
  },
  {
    key: "nationality",
    label: "Nationality",
    render: (row) => <span>{(row.nationality as string) || "—"}</span>,
  },
  {
    key: "preferredCurrency",
    label: "Currency",
  },
  {
    key: "isActive",
    label: "Status",
    render: (row) => (
      <StatusBadge
        status={(row.isActive as boolean) ? "active" : "inactive"}
        label={(row.isActive as boolean) ? "Active" : "Inactive"}
      />
    ),
  },
];

const SHAREHOLDER_STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

export default function Shareholders() {
  const { token } = useAuthStore();
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Shareholder | undefined>();
  const [equityTarget, setEquityTarget] = useState<Shareholder | undefined>();
  const [settlementTarget, setSettlementTarget] = useState<Shareholder | undefined>();

  const { data: shareholdersData, isLoading } = useQuery({
    queryKey: ["shareholders"],
    queryFn: async () => {
      const r = await fetch(`/api/shareholders?org_id=${ORG_ID}`, { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const allShareholders: Shareholder[] = shareholdersData?.data ?? [];
  const shareholderRows = allShareholders as unknown as ShareholderRow[];

  const branches: Branch[] = (branchesData?.data ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    name: b.name as string,
    internalCode: b.internal_code as string,
  }));

  return (
    <DashboardLayout>
      <div className="p-6">
        <ListPageWrapper
          title="Shareholders"
          subtitle="Equity management & profit settlements"
          data={shareholderRows}
          columns={SHAREHOLDER_COLUMNS}
          cardRenderer={(row) => {
            const s = row as unknown as Shareholder;
            return (
              <ShareholderCard
                shareholder={s}
                onEquity={() => setEquityTarget(s)}
                onSettle={() => setSettlementTarget(s)}
                onEdit={() => { setEditItem(s); setShowForm(true); }}
              />
            );
          }}
          filterKey="isActive"
          filterLabel="Status"
          filterOptions={SHAREHOLDER_STATUS_OPTIONS}
          searchKeys={["name", "email", "nationality", "phone"]}
          searchPlaceholder="Search shareholders..."
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/shareholders/${(row as { id: string }).id}`)}
          onAddNew={() => { setEditItem(undefined); setShowForm(true); }}
          addNewLabel="Add Shareholder"
          emptyIcon={<Users className="w-12 h-12" />}
          emptyMessage="No shareholders found"
        />
      </div>

      {showForm && (
        <ShareholderForm editItem={editItem} onClose={() => { setShowForm(false); setEditItem(undefined); }} />
      )}
      {equityTarget && (
        <EquityForm shareholder={equityTarget} branches={branches} onClose={() => setEquityTarget(undefined)} />
      )}
      {settlementTarget && (
        <SettlementModal
          shareholder={settlementTarget}
          branches={branches}
          onClose={() => setSettlementTarget(undefined)}
        />
      )}
    </DashboardLayout>
  );
}
