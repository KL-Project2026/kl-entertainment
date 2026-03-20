import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { AvailabilityCalendar } from "@/components/shared/AvailabilityCalendar";

function DetailRow({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

const TAB_ITEMS: [string, string][] = [
  ["info", "기본 정보"],
  ["availability", "가용성 관리"],
];

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("info");

  const { data: table, isLoading, error } = useQuery({
    queryKey: ["table", id],
    queryFn: async () => {
      const r = await fetch(`/api/tables/${id}`);
      if (!r.ok) throw new Error("Not found");
      const d = await r.json();
      return (d.data ?? d) as Record<string, unknown>;
    },
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4 animate-pulse max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-white/5 rounded" />
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !table) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>테이블을 찾을 수 없습니다. (/api/tables/:id 엔드포인트 미구현)</p>
          <Button variant="ghost" onClick={() => navigate("/tables")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/tables")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-display font-bold">{String(table.name ?? "테이블")}</h1>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", flexWrap: "wrap" }}>
          {TAB_ITEMS.map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: "10px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === key ? "#D1AE38" : "transparent"}`,
              marginBottom: -2, fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? "#D1AE38" : "#6b7280",
              cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {activeTab === "info" && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" /> 테이블 정보
            </h3>
            <DetailRow label="테이블명" value={String(table.name ?? "—")} />
            <DetailRow label="수용 인원" value={table.capacity != null ? `${table.capacity}명` : null} />
            <DetailRow label="위치" value={String(table.location ?? "—")} />
            <DetailRow label="상태" value={String(table.status ?? "—")} />
            {table.notes != null && <DetailRow label="메모" value={String(table.notes)} />}
          </Card>
        )}

        {activeTab === "availability" && (
          <AvailabilityCalendar entityType="table" entityId={id!} />
        )}
      </div>
    </DashboardLayout>
  );
}
