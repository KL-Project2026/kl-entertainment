import { useAuthStore } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { useListBranches, useGetBranchDashboard } from "@workspace/api-client-react";
import { Card, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { CreditCard, BedDouble, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useState, useEffect } from "react";

const MOCK_CHART_DATA = [
  { time: '18:00', revenue: 1200 }, { time: '19:00', revenue: 3000 },
  { time: '20:00', revenue: 5500 }, { time: '21:00', revenue: 8400 },
  { time: '22:00', revenue: 12500 }, { time: '23:00', revenue: 18000 },
  { time: '00:00', revenue: 24500 }, { time: '01:00', revenue: 31000 }
];

const ROOM_STATUS_TONE: Record<string, string> = {
  Occupied:    "bg-danger",
  Available:   "bg-success",
  Cleaning:    "bg-warning",
  Maintenance: "bg-text-tertiary",
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId || null);

  const { data: branchesData } = useListBranches();

  useEffect(() => {
    if (!selectedBranchId && branchesData?.data && branchesData.data.length > 0) {
      setSelectedBranchId(branchesData.data[0].id);
    }
  }, [branchesData, selectedBranchId]);

  const { data: dashboardData, isLoading } = useGetBranchDashboard(selectedBranchId || "", {
    query: { enabled: !!selectedBranchId }
  });

  const stats = dashboardData?.data || {
    today: { revenue: 0, reservationCount: 0, checkedInCount: 0, occupancyPct: 0 },
    rooms: { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 }
  };

  const roomBreakdown = [
    { label: 'Occupied',    count: stats.rooms.occupied },
    { label: 'Available',   count: stats.rooms.available },
    { label: 'Cleaning',    count: stats.rooms.cleaning },
    { label: 'Maintenance', count: stats.rooms.maintenance },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("nav.dashboard")}
        title={t("pages.dashboard.title")}
        description="Today's revenue, occupancy, and room status at a glance."
      />

      {user?.role === 'super_admin' && branchesData?.data && (
        <Tabs
          tabs={branchesData.data.map(b => ({ id: b.id, label: b.name }))}
          activeTab={selectedBranchId || ""}
          onChange={setSelectedBranchId}
        />
      )}

      {/* §12 — KPI strip. Only the primary metric (Revenue) gets gold emphasis. */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-lg border border-border-subtle bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Today's Revenue"
            value={formatCurrency(stats.today.revenue)}
            icon={CreditCard}
            emphasis="gold"
            delta={{ value: "+12.4%", trend: "up" }}
            deltaSuffix="vs yesterday"
          />
          <KpiCard
            label="Occupancy Rate"
            value={`${stats.today.occupancyPct}%`}
            icon={TrendingUp}
          />
          <KpiCard
            label="Active Reservations"
            value={stats.today.reservationCount.toString()}
            icon={Users}
          />
          <KpiCard
            label="Rooms Available"
            value={`${stats.rooms.available} / ${stats.rooms.total}`}
            icon={BedDouble}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-6 text-text-primary">Revenue Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CHART_DATA}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--gold)" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(0 0% 100% / 0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(0 0% 100% / 0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${v/1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: 'var(--gold)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6 text-text-primary">Room Status</h3>
          <div className="space-y-3">
            {roomBreakdown.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${ROOM_STATUS_TONE[item.label] ?? "bg-text-tertiary"}`} />
                  <span className="text-sm text-text-secondary">{item.label}</span>
                </div>
                <span className="text-sm font-mono tabular-nums text-text-primary">{item.count}</span>
              </div>
            ))}

            <div className="pt-4 mt-4 border-t border-border-subtle">
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden flex">
                <div className="bg-danger  h-full" style={{ width: `${(stats.rooms.occupied    / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-warning h-full" style={{ width: `${(stats.rooms.cleaning    / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-text-tertiary h-full" style={{ width: `${(stats.rooms.maintenance / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-success h-full flex-1" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
