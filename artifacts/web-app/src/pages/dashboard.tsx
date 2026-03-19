import { useAuthStore } from "@/lib/auth";
import { useListBranches, useGetBranchDashboard } from "@workspace/api-client-react";
import { Card, Tabs } from "@/components/ui";
import { Users, CreditCard, BedDouble, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useState, useEffect } from "react";

// Mock data for the chart since the API doesn't provide historical data directly yet
const MOCK_CHART_DATA = [
  { time: '18:00', revenue: 1200 }, { time: '19:00', revenue: 3000 },
  { time: '20:00', revenue: 5500 }, { time: '21:00', revenue: 8400 },
  { time: '22:00', revenue: 12500 }, { time: '23:00', revenue: 18000 },
  { time: '00:00', revenue: 24500 }, { time: '01:00', revenue: 31000 }
];

export default function Dashboard() {
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

  const CARDS = [
    { label: "Today's Revenue", value: formatCurrency(stats.today.revenue), icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Occupancy Rate", value: `${stats.today.occupancyPct}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Reservations", value: stats.today.reservationCount.toString(), icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Rooms Available", value: `${stats.rooms.available} / ${stats.rooms.total}`, icon: BedDouble, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  return (
    <div className="space-y-6">
      {user?.role === 'super_admin' && branchesData?.data && (
        <Tabs 
          tabs={branchesData.data.map(b => ({ id: b.id, label: b.name }))}
          activeTab={selectedBranchId || ""}
          onChange={setSelectedBranchId}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((stat, i) => (
            <Card key={i} className="p-6 flex items-start gap-4">
              <div className={`p-4 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-foreground font-display">{stat.value}</h3>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-6">Revenue Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CHART_DATA}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#13131F', borderColor: 'rgba(212, 175, 55, 0.2)', borderRadius: '8px' }}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-6">Room Status Breakdown</h3>
          <div className="space-y-4">
            {[
              { label: 'Occupied', count: stats.rooms.occupied, color: 'bg-red-500' },
              { label: 'Available', count: stats.rooms.available, color: 'bg-emerald-500' },
              { label: 'Cleaning', count: stats.rooms.cleaning, color: 'bg-amber-500' },
              { label: 'Maintenance', count: stats.rooms.maintenance, color: 'bg-gray-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color} shadow-[0_0_10px_currentColor]`} />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
            
            <div className="pt-6 mt-4 border-t border-white/5">
              <div className="w-full bg-black/50 rounded-full h-3 overflow-hidden flex">
                <div className="bg-red-500 h-full" style={{ width: `${(stats.rooms.occupied / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${(stats.rooms.cleaning / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-gray-500 h-full" style={{ width: `${(stats.rooms.maintenance / (stats.rooms.total || 1)) * 100}%` }} />
                <div className="bg-emerald-500 h-full flex-1" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
