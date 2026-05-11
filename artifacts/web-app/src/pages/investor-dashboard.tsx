import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { io, Socket } from "socket.io-client";
import { Activity, TrendingUp, Users, Home, Wifi, WifiOff, RefreshCw } from "lucide-react";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ActivityItem {
  id: string;
  type: "revenue" | "reservation";
  time: string;
  branchId: string;
  text: string;
  amount?: number;
}

interface BranchSnapshot {
  branchId: string;
  branchName: string;
  internalCode: string;
  equityPct: number;
  today: { revenue: number; orderCount: number };
  thisMonth: { revenue: number; orderCount: number; estimatedPayout: number };
  rooms: { total: number; available: number; occupied: number; reserved: number; occupancyPct: number };
}

function OccupancyBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct >= 80 ? "bg-rose-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function InvestorDashboard() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [selectedBranch, setSelectedBranch] = useState("__all__");
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [granularity, setGranularity] = useState<"daily" | "hourly">("hourly");

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  // Main dashboard snapshot (REST)
  const { data: dashData, refetch: refetchDash, isLoading } = useQuery({
    queryKey: ["investor-dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/investor/dashboard", { headers: getAuthHeader(token) });
      return r.json();
    },
    refetchInterval: 60000,
  });

  const branches: BranchSnapshot[] = dashData?.data?.branches ?? [];
  const filteredBranches = selectedBranch === "__all__"
    ? branches
    : branches.filter((b) => b.branchId === selectedBranch);

  // Revenue chart data
  const { data: revenueData } = useQuery({
    queryKey: ["investor-revenue", selectedBranch === "__all__" ? branches[0]?.branchId : selectedBranch],
    queryFn: async () => {
      const branchId = selectedBranch === "__all__" ? branches[0]?.branchId : selectedBranch;
      if (!branchId) return null;
      const r = await fetch(
        `/api/investor/revenue?branch_id=${branchId}&from=${firstOfMonth}&to=${today}`,
        { headers: getAuthHeader(token) }
      );
      return r.json();
    },
    enabled: branches.length > 0,
  });

  const chartData = granularity === "hourly"
    ? (revenueData?.data?.hourly ?? []).map((h: { hour: number; amount: number }) => ({
        label: `${String(h.hour).padStart(2, "0")}:00`,
        revenue: h.amount,
      }))
    : (revenueData?.data?.daily ?? []).map((d: { date: string; amount: number }) => ({
        label: d.date.slice(5),
        revenue: d.amount,
      }));

  // Socket.io connection for live updates
  useEffect(() => {
    // MIGRATION: env-based API base for Railway+Vercel split
    const baseUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined) || window.location.origin;
    const socket = io(baseUrl, { path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      // Join investor rooms for each branch
      branches.forEach((b) => {
        // We don't have shareholderId client-side without extra API call;
        // rely on REST polling for now and use socket for real-time events
      });
    });

    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("revenue_update", (data: { branchId: string; orderNo: string; totalAmount: number; paymentMethod: string; updatedAt: string }) => {
      const item: ActivityItem = {
        id: data.updatedAt + data.orderNo,
        type: "revenue",
        time: new Date(data.updatedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
        branchId: data.branchId,
        text: `Order ${data.orderNo} paid — ${data.paymentMethod}`,
        amount: data.totalAmount,
      };
      setActivityFeed((prev) => [item, ...prev].slice(0, 50));
      refetchDash();
    });

    socket.on("reservation_update", (data: { branchId: string; reservationNo: string; status: string; roomName?: string; guestCount?: number; updatedAt: string }) => {
      const item: ActivityItem = {
        id: data.updatedAt + data.reservationNo,
        type: "reservation",
        time: new Date(data.updatedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
        branchId: data.branchId,
        text: `${data.reservationNo} — ${data.status}${data.roomName ? ` · ${data.roomName}` : ""}${data.guestCount ? ` · ${data.guestCount} guests` : ""}`,
      };
      setActivityFeed((prev) => [item, ...prev].slice(0, 50));
      refetchDash();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const totals = filteredBranches.reduce(
    (acc, b) => ({
      todayRevenue: acc.todayRevenue + b.today.revenue,
      monthRevenue: acc.monthRevenue + b.thisMonth.revenue,
      estimatedPayout: acc.estimatedPayout + b.thisMonth.estimatedPayout,
      rooms: acc.rooms + b.rooms.total,
      occupied: acc.occupied + b.rooms.occupied,
    }),
    { todayRevenue: 0, monthRevenue: 0, estimatedPayout: 0, rooms: 0, occupied: 0 }
  );

  const overallOccupancyPct = totals.rooms > 0
    ? Math.round((totals.occupied / totals.rooms) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold">{t("pages.investor_dashboard.title")}</h1>
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                socketConnected
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-500/15 text-slate-400 border-slate-500/30"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                {socketConnected ? "LIVE" : "OFFLINE"}
              </div>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Real-time performance dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.branchId} value={b.branchId}>{b.branchName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetchDash()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>
        ) : (
          <>
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Today Revenue</p>
                <p className="text-2xl font-bold mt-2 text-emerald-400">
                  RM {totals.todayRevenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredBranches.reduce((s, b) => s + b.today.orderCount, 0)} orders
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">This Month Net</p>
                <p className="text-2xl font-bold mt-2">
                  RM {totals.monthRevenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredBranches.reduce((s, b) => s + b.thisMonth.orderCount, 0)} orders
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Occupancy</p>
                <p className="text-2xl font-bold mt-2">{overallOccupancyPct}%</p>
                <OccupancyBar pct={overallOccupancyPct} />
                <p className="text-xs text-muted-foreground mt-1">{totals.occupied}/{totals.rooms} rooms</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. My Payout</p>
                <p className="text-2xl font-bold mt-2 text-primary">
                  RM {totals.estimatedPayout.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">based on equity %</p>
              </Card>
            </div>

            {/* Branch breakdown */}
            {filteredBranches.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredBranches.map((b) => (
                  <Card key={b.branchId} className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{b.branchName}</p>
                        <p className="text-xs text-muted-foreground">{b.internalCode}</p>
                      </div>
                      <Badge className="text-xs bg-primary/20 text-primary border border-primary/30">
                        {(b.equityPct * 100).toFixed(0)}% equity
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Today</p>
                        <p className="font-bold">RM {b.today.revenue.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Month</p>
                        <p className="font-bold">RM {b.thisMonth.revenue.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">My Share</p>
                        <p className="font-bold text-primary">RM {b.thisMonth.estimatedPayout.toFixed(0)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Occupancy {b.rooms.occupancyPct}% ({b.rooms.occupied}/{b.rooms.total} rooms)
                      </p>
                      <OccupancyBar pct={b.rooms.occupancyPct} />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Revenue chart + live feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="p-5 lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <p className="font-medium">Revenue Trend</p>
                  <div className="flex gap-1">
                    {(["hourly", "daily"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGranularity(g)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                          granularity === g
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {g === "hourly" ? "Today (Hourly)" : "Monthly (Daily)"}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      formatter={(v: number) => [`RM ${v.toFixed(2)}`, "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#C9A84C" fill="url(#revGradient)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Live activity feed */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">Live Activity</p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activityFeed.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Waiting for live events...
                    </p>
                  ) : (
                    activityFeed.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          item.type === "revenue" ? "bg-emerald-400" : "bg-blue-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground">{item.time} </span>
                          <span className="text-foreground">{item.text}</span>
                          {item.amount && (
                            <span className="text-primary ml-1 font-medium">RM {item.amount.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
