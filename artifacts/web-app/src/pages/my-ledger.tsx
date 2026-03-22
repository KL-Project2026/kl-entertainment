import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, RefreshCw,
  ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
interface LedgerAccount {
  id: string;
  account_type: string;
  entity_type: string;
  currency: string;
  balance_cache: string;
  balance_updated_at: string;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  direction: "CR" | "DR";
  amount: string;
  currency: string;
  description: string | null;
  reference_no: string | null;
  effective_date: string;
  status: string;
  source_type: string;
  account_type: string;
  entity_type: string;
}

interface LedgerSummary {
  total_cr: number;
  total_dr: number;
  net: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMYR(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  salary:             "Salary",
  bonus:              "Bonus",
  allowance:          "Allowance",
  overtime:           "Overtime",
  deduction:          "Deduction",
  advance:            "Cash Advance",
  commission_session: "Session Commission",
  commission_booking: "Booking Commission",
  payout:             "Payout",
  reversal:           "Reversal",
  adjustment:         "Adjustment",
};

const ENTRY_COLORS: Record<string, string> = {
  salary:             "#60a5fa",
  bonus:              "#f5c842",
  allowance:          "#4ade80",
  overtime:           "#34d399",
  deduction:          "#f87171",
  advance:            "#fb923c",
  commission_session: "#e8407a",
  commission_booking: "#e8407a",
  payout:             "#a78bfa",
  reversal:           "#9ca3af",
  adjustment:         "#9ca3af",
};

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#13141a] p-4 flex items-center gap-4">
      <div className="size-10 rounded-full flex items-center justify-center" style={{ background: accent + "22" }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-bold" style={{ color: accent }}>{value}</p>
      </div>
    </div>
  );
}

// ── Entry Row ─────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: LedgerEntry }) {
  const isCr   = entry.direction === "CR";
  const color  = isCr ? "#4ade80" : "#f87171";
  const label  = ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type;
  const accent = ENTRY_COLORS[entry.entry_type] ?? "#9ca3af";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div
        className="size-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: accent + "22" }}
      >
        {isCr
          ? <TrendingUp size={14} style={{ color: accent }} />
          : <TrendingDown size={14} style={{ color: "#f87171" }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{label}</span>
          {entry.entity_type === "hostess_profile" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-pink-500/50 text-pink-400">
              Hostess
            </Badge>
          )}
          {entry.status !== "posted" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
              {entry.status}
            </Badge>
          )}
        </div>
        {entry.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{fmtDate(entry.effective_date)}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold" style={{ color }}>
          {isCr ? "+" : "−"}{fmtMYR(entry.amount)}
        </p>
        {entry.reference_no && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{entry.reference_no}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyLedger() {
  const { token } = useAuthStore();
  const { toast } = useToast();

  const [accounts, setAccounts]       = useState<LedgerAccount[]>([]);
  const [entries,  setEntries]        = useState<LedgerEntry[]>([]);
  const [total,    setTotal]          = useState(0);
  const [summary,  setSummary]        = useState<LedgerSummary | null>(null);
  const [loading,  setLoading]        = useState(true);
  const [showFilter, setShowFilter]   = useState(false);
  const [filterDir, setFilterDir]     = useState<"" | "CR" | "DR">("");
  const [page,     setPage]           = useState(0);
  const LIMIT = 30;

  async function load(reset = false) {
    setLoading(true);
    try {
      const p = reset ? 0 : page;
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(p * LIMIT) });
      const res  = await fetch(`/api/ledger/my?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ title: "Failed to load ledger", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setAccounts(data.accounts ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
      let rows: LedgerEntry[] = data.entries ?? [];
      if (filterDir) rows = rows.filter((e) => e.direction === filterDir);
      setEntries(rows);
    } catch {
      toast({ title: "Network error", description: "Could not reach server", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, [filterDir, page]);

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance_cache ?? "0"), 0);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Account Ledger</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your earnings, deductions &amp; transactions</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        {/* Balance cards */}
        {loading && !summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard label="Total Balance"     value={fmtMYR(totalBalance)}    icon={Wallet}       accent="#a78bfa" />
            <SummaryCard label="Income (90 days)"  value={fmtMYR(summary.total_cr)} icon={TrendingUp}  accent="#4ade80" />
            <SummaryCard label="Debits (90 days)"  value={fmtMYR(summary.total_dr)} icon={TrendingDown} accent="#f87171" />
          </div>
        ) : null}

        {/* Account badges */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-[#13141a] px-3 py-2 flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
                  {a.entity_type === "hostess_profile" ? "Hostess Account" : "Staff Account"}
                </span>
                <span className="text-sm font-semibold text-foreground">{fmtMYR(a.balance_cache)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowFilter((v) => !v)}
          >
            <Filter size={13} />
            Filter
            {showFilter ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </Button>
          {filterDir && (
            <Badge
              variant="outline"
              className="cursor-pointer text-xs"
              onClick={() => { setFilterDir(""); setPage(0); }}
            >
              {filterDir === "CR" ? "Credits only" : "Debits only"} ×
            </Badge>
          )}
        </div>

        {showFilter && (
          <div className="rounded-xl border border-white/10 bg-[#13141a] p-4 flex gap-2 flex-wrap">
            {(["", "CR", "DR"] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={filterDir === d ? "default" : "outline"}
                className="text-xs"
                onClick={() => { setFilterDir(d); setPage(0); }}
              >
                {d === "" ? "All" : d === "CR" ? "Credits" : "Debits"}
              </Button>
            ))}
          </div>
        )}

        {/* No account */}
        {!loading && accounts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-[#13141a] p-10 text-center">
            <Wallet size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">No ledger account found.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Your account will appear here once payroll has been processed.
            </p>
          </div>
        )}

        {/* Entries list */}
        {accounts.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-[#13141a] px-4">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No transactions found.</div>
            ) : (
              entries.map((e) => <EntryRow key={e.id} entry={e} />)
            )}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} transactions total</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={(page + 1) * LIMIT >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
