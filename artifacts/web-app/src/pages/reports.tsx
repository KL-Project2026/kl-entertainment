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
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart2, TrendingUp, Building, Users } from "lucide-react";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const CHART_COLORS = ["#C9A84C", "#7C5CBF", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

const TAB_ICONS = {
  revenue: TrendingUp,
  occupancy: Building,
  commissions: Users,
  "profit-loss": BarChart2,
};

type TabKey = keyof typeof TAB_ICONS;

function RevenueReport({ branchId, from, to }: { branchId: string; from: string; to: string }) {
  const { token } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["report-revenue", branchId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/revenue?branch_id=${branchId}&from=${from}&to=${to}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const d = data?.data;
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!d) return <div className="text-center py-12 text-muted-foreground">No data. Select a branch above.</div>;

  const categoryData = Object.entries(d.byCategory || {}).map(([k, v]) => ({
    name: k.replace("_", " "),
    value: v as number,
  }));

  const trendData = d.daily.map((day: { date: string; amount: number }) => ({
    label: day.date.slice(5),
    revenue: day.amount,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">RM {d.total.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold mt-1">{d.totalOrders}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Avg per Order</p>
          <p className="text-2xl font-bold mt-1">
            RM {d.totalOrders > 0 ? (d.total / d.totalOrders).toFixed(2) : "0.00"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm font-medium mb-4">Daily Revenue Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `RM${v}`} />
              <Tooltip
                contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                formatter={(v: number) => [`RM ${v.toFixed(2)}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#C9A84C" fill="url(#revFill)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium mb-4">Revenue by Category</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={60}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `RM ${v.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {cat.name}
                </span>
                <span className="text-muted-foreground">RM {cat.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function OccupancyReport({ branchId, month }: { branchId: string; month: string }) {
  const { token } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["report-occupancy", branchId, month],
    queryFn: async () => {
      const r = await fetch(`/api/reports/occupancy?branch_id=${branchId}&month=${month}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const d = data?.data;
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!d) return <div className="text-center py-12 text-muted-foreground">No data. Select a branch above.</div>;

  const chartData = (d.byRoom ?? []).map((r: { roomName: string; occupancyPct: number; revenue: number }) => ({
    name: r.roomName,
    occupancy: r.occupancyPct,
    revenue: r.revenue,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Overall Occupancy</p>
          <p className="text-3xl font-bold text-primary mt-1">{Math.round((d.overall ?? 0) * 100)}%</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Room Revenue</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">RM {(d.totalRevenue ?? 0).toFixed(0)}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium mb-4">Occupancy by Room</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 11 }} width={80} />
            <Tooltip
              contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              formatter={(v: number) => [`${v}%`, "Occupancy"]}
            />
            <Bar dataKey="occupancy" fill="#C9A84C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reservations</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Occupancy</th>
              <th className="px-4 py-3">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {(d.byRoom ?? []).map((r: { roomName: string; roomType: string; reservationCount: number; totalHours: number; occupancyPct: number; revenue: number }) => (
              <tr key={r.roomName} className="border-t border-white/5">
                <td className="px-4 py-3">{r.roomName}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{r.roomType}</td>
                <td className="px-4 py-3">{r.reservationCount}</td>
                <td className="px-4 py-3">{r.totalHours}h</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/10 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${r.occupancyPct}%` }}
                      />
                    </div>
                    <span>{r.occupancyPct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-emerald-400">RM {r.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommissionsReport({ branchId, month }: { branchId: string; month: string }) {
  const { token } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["report-commissions", branchId, month],
    queryFn: async () => {
      const r = await fetch(`/api/reports/commissions?branch_id=${branchId}&month=${month}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const d = data?.data;
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!d) return <div className="text-center py-12 text-muted-foreground">No data.</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-bold mt-1">{d.summary.totalSessions}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Gross Fees</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">RM {d.summary.totalGrossFees?.toFixed(2) ?? "0.00"}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Agent Commissions Paid</p>
          <p className="text-2xl font-bold mt-1 text-orange-400">RM {d.summary.totalAgentCommissionsPaid?.toFixed(2) ?? "0.00"}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium mb-4">Hostess Performance</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                <th className="pb-2">Name</th>
                <th className="pb-2">Sessions</th>
                <th className="pb-2">Gross Fees</th>
                <th className="pb-2">Agent Cut</th>
                <th className="pb-2">Penalties</th>
                <th className="pb-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {d.hostesses.map((h: { staffId: string; name: string; sessions: number; grossFees: number; agentDeductions: number; penalties: number; netEarnings: number }) => (
                <tr key={h.staffId} className="border-t border-white/5">
                  <td className="py-2.5">{h.name}</td>
                  <td className="py-2.5">{h.sessions}</td>
                  <td className="py-2.5">RM {h.grossFees.toFixed(2)}</td>
                  <td className="py-2.5 text-orange-400">-RM {h.agentDeductions.toFixed(2)}</td>
                  <td className="py-2.5 text-red-400">-RM {h.penalties.toFixed(2)}</td>
                  <td className="py-2.5 font-medium text-emerald-400">RM {h.netEarnings.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {d.agents.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-medium mb-4">Agent Payouts</p>
          <div className="space-y-2">
            {d.agents.map((a: { agentId: string; name: string; payoutCount: number; totalPaidMyr: number; commissionRate: number }) => (
              <div key={a.agentId} className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {(a.commissionRate * 100).toFixed(0)}% · {a.payoutCount} payouts
                  </span>
                </div>
                <span className="font-medium">RM {a.totalPaidMyr.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PnLReport({ branchId, month }: { branchId: string; month: string }) {
  const { token } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["report-pnl", branchId, month],
    queryFn: async () => {
      const r = await fetch(`/api/reports/profit-loss?branch_id=${branchId}&month=${month}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
    enabled: !!branchId,
  });

  const d = data?.data;
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!d) return <div className="text-center py-12 text-muted-foreground">No data.</div>;

  const revenueItems = [
    { label: "Room Charges", value: d.revenue.room },
    { label: "Hostess Fees", value: d.revenue.hostess },
    { label: "Products & Beverages", value: d.revenue.product },
    { label: "Pickup Fees", value: d.revenue.pickup },
    { label: "Extension Charges", value: d.revenue.extension },
  ].filter((i) => i.value > 0);

  const expenseItems = Object.entries(d.expenses.breakdown ?? {}).map(([k, v]) => ({
    label: k.replace(/_/g, " "),
    value: v as number,
  }));

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Gross Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">RM {d.revenue.gross.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold text-red-400 mt-1">RM {d.expenses.total.toFixed(2)}</p>
        </Card>
        <Card className={`p-4 text-center border ${d.netProfit >= 0 ? "border-primary/30" : "border-red-500/30"}`}>
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={`text-2xl font-bold mt-1 ${d.netProfit >= 0 ? "text-primary" : "text-red-400"}`}>
            RM {d.netProfit.toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-medium mb-4 text-emerald-400">Revenue Breakdown</p>
          <div className="space-y-2">
            {revenueItems.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">{item.label}</span>
                <span>RM {item.value.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
              <span>Total Revenue</span>
              <span className="text-emerald-400">RM {d.revenue.gross.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium mb-4 text-red-400">Expense Breakdown</p>
          {expenseItems.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No expenses recorded</p>
          ) : (
            <div className="space-y-2">
              {expenseItems.map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{item.label}</span>
                  <span>RM {item.value.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span>Total Expenses</span>
                <span className="text-red-400">RM {d.expenses.total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Profit margin bar */}
      <Card className="p-5">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-muted-foreground">Profit Margin</span>
          <span className="font-bold">
            {d.revenue.gross > 0 ? ((d.netProfit / d.revenue.gross) * 100).toFixed(1) : "0"}%
          </span>
        </div>
        <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${d.revenue.gross > 0 ? (d.expenses.total / d.revenue.gross) * 100 : 0}%` }}
          />
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${d.revenue.gross > 0 ? Math.max(0, d.netProfit / d.revenue.gross) * 100 : 0}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Expenses</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Net Profit</span>
        </div>
      </Card>
    </div>
  );
}

export default function Reports() {
  const { token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>("revenue");
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "revenue", label: "Revenue" },
    { key: "occupancy", label: "Occupancy" },
    { key: "commissions", label: "Commissions" },
    { key: "profit-loss", label: "P&L" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">Revenue, occupancy, commission & P&L analytics</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeTab === "revenue" ? (
              <div className="flex gap-2 items-center">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
                <span className="text-muted-foreground text-sm">to</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
              </div>
            ) : (
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36" />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {tabs.map(({ key, label }) => {
            const Icon = TAB_ICONS[key];
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === key
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {!branchId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a branch to view reports
          </div>
        ) : activeTab === "revenue" ? (
          <RevenueReport branchId={branchId} from={from} to={to} />
        ) : activeTab === "occupancy" ? (
          <OccupancyReport branchId={branchId} month={month} />
        ) : activeTab === "commissions" ? (
          <CommissionsReport branchId={branchId} month={month} />
        ) : (
          <PnLReport branchId={branchId} month={month} />
        )}
      </div>
    </DashboardLayout>
  );
}
