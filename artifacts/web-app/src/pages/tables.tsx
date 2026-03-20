import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { LayoutGrid } from "lucide-react";

interface TableRecord {
  id: string;
  name: string;
  capacity?: number;
  status?: string;
  location?: string;
}

const STATUS_OPTS = [
  { value: "available",   label: "Available" },
  { value: "occupied",    label: "Occupied" },
  { value: "reserved",    label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
];

const COLUMNS: ColumnDef<Record<string, unknown>>[] = [
  {
    key: "name",
    label: "테이블명",
    render: (row) => <span className="font-medium">{row.name as string}</span>,
  },
  {
    key: "capacity",
    label: "수용 인원",
    render: (row) => <span className="text-sm text-muted-foreground">{row.capacity != null ? `${row.capacity}명` : "—"}</span>,
  },
  {
    key: "location",
    label: "위치",
    render: (row) => <span className="text-sm text-muted-foreground">{(row.location as string) || "—"}</span>,
  },
  {
    key: "status",
    label: "상태",
    render: (row) => {
      const label = STATUS_OPTS.find(o => o.value === row.status)?.label ?? String(row.status ?? "—");
      return <span className="text-sm">{label}</span>;
    },
  },
];

export default function Tables() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const r = await fetch("/api/tables");
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data ?? d ?? []) as TableRecord[];
    },
    retry: false,
  });

  const tables = (data ?? []) as unknown as Record<string, unknown>[];

  return (
    <DashboardLayout>
      <div className="p-6">
        <ListPageWrapper
          title="테이블"
          subtitle="테이블 현황 및 가용성 관리"
          data={tables}
          columns={COLUMNS}
          cardRenderer={(row) => (
            <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex justify-between items-start">
                <span className="font-medium">{row.name as string}</span>
                {row.status != null && (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/10">
                    {STATUS_OPTS.find(o => o.value === row.status)?.label ?? String(row.status)}
                  </span>
                )}
              </div>
              {row.capacity != null && (
                <p className="text-xs text-muted-foreground">수용: {String(row.capacity)}명</p>
              )}
              {row.location != null && (
                <p className="text-xs text-muted-foreground">{String(row.location)}</p>
              )}
            </div>
          )}
          filterKey="status"
          filterLabel="상태"
          filterOptions={STATUS_OPTS}
          searchKeys={["name", "location"]}
          searchPlaceholder="테이블 검색..."
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/tables/${(row as { id: string }).id}`)}
          emptyIcon={<LayoutGrid className="w-10 h-10" />}
          emptyMessage="테이블 데이터가 없습니다 (/api/tables 엔드포인트 미구현)"
        />
      </div>
    </DashboardLayout>
  );
}
