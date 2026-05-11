import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { BarChart3, TrendingUp, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DailyData {
  revenue?: {
    room_revenue: number;
    pos_revenue: number;
    hostess_revenue: number;
    outcall_revenue: number;
    total_revenue: number;
  };
  payments?: {
    cash_received: number;
    card_received: number;
    total_received: number;
  };
  branch_id?: string;
  date?: string;
}

export default function DailyReport() {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/daily?date=${date}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  const revenueItems = [
    ["Room Charge",  data?.revenue?.room_revenue],
    ["POS",          data?.revenue?.pos_revenue],
    ["Hostess",      data?.revenue?.hostess_revenue],
    ["Outcall",      data?.revenue?.outcall_revenue],
    ["Total",        data?.revenue?.total_revenue],
  ] as [string, number | undefined][];

  const paymentItems = [
    ["Cash",           data?.payments?.cash_received],
    ["Card",           data?.payments?.card_received],
    ["Total Received", data?.payments?.total_received],
  ] as [string, number | undefined][];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> {t("pages.daily_report.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Daily revenue &amp; payment overview</p>
          </div>
          <DateInput value={date} onChange={e => setDate(e.target.value)} wrapperClassName="w-44" />
        </div>

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-white/5 rounded-xl" />
            <div className="h-32 bg-white/5 rounded-xl" />
          </div>
        )}

        {data && !loading && (
          <>
            {/* Revenue */}
            <Card className="p-5 bg-black/40 border-white/5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Revenue
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {revenueItems.map(([label, value]) => (
                  <div key={label} className={`rounded-xl p-4 border text-center ${label === "Total" ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/10"}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-base font-display font-bold ${label === "Total" ? "text-primary" : ""}`}>
                      {value != null ? formatCurrency(value) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payments */}
            <Card className="p-5 bg-black/40 border-white/5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Payments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {paymentItems.map(([label, value]) => (
                  <div key={label} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-base font-display font-bold text-emerald-400">
                      {value != null ? formatCurrency(value) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {!data && !loading && (
          <Card className="p-12 text-center bg-black/40 border-white/5">
            <p className="text-muted-foreground">No data for the selected date.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
