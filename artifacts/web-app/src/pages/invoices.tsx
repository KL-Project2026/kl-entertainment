import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { Receipt } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Invoice {
  id: string;
  invoice_no: string;
  reservation_id: string;
  booking_ref: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  issued_at: string | null;
}

const STATUS_OPTS = [
  { value: "draft",          label: "초안" },
  { value: "issued",         label: "발행" },
  { value: "partially_paid", label: "부분결제" },
  { value: "paid",           label: "결제완료" },
  { value: "void",           label: "취소" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid:          { bg: "#dcfce7", color: "#166534" },
  partially_paid:{ bg: "#fef9c3", color: "#854d0e" },
  issued:        { bg: "#dbeafe", color: "#1e40af" },
  draft:         { bg: "#f3f4f6", color: "#6b7280" },
  void:          { bg: "#fee2e2", color: "#991b1b" },
};

const COLUMNS: ColumnDef<Record<string, unknown>>[] = [
  {
    key: "invoice_no",
    label: "Invoice No",
    render: (row) => (
      <span className="font-mono text-sm font-bold text-primary">
        {row.invoice_no as string}
      </span>
    ),
  },
  {
    key: "booking_ref",
    label: "예약 Ref",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{(row.booking_ref as string) || "—"}</span>
    ),
  },
  {
    key: "issued_at",
    label: "발행일",
    render: (row) => <span className="text-sm">{row.issued_at ? formatDate(row.issued_at as string) : "—"}</span>,
  },
  {
    key: "total_amount",
    label: "금액",
    render: (row) => (
      <span className="text-sm font-semibold">{formatCurrency(Number(row.total_amount ?? 0))}</span>
    ),
  },
  {
    key: "status",
    label: "상태",
    render: (row) => {
      const s = STATUS_STYLE[row.status as string] ?? { bg: "#f3f4f6", color: "#374151" };
      const label = STATUS_OPTS.find(o => o.value === row.status)?.label ?? String(row.status);
      return (
        <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
          {label}
        </span>
      );
    },
  },
];

export default function Invoices() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const r = await fetch("/api/invoices");
      if (!r.ok) return [];
      const d = await r.json();
      return (d.data ?? []) as Invoice[];
    },
  });

  const invoices = (data ?? []) as unknown as Record<string, unknown>[];

  return (
    <DashboardLayout>
      <div className="p-6">
        <ListPageWrapper
          title="인보이스"
          subtitle="예약 인보이스 및 결제 내역"
          data={invoices}
          columns={COLUMNS}
          cardRenderer={(row) => (
            <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex justify-between items-start">
                <span className="font-mono font-bold text-primary text-sm">{row.invoice_no as string}</span>
                {(() => {
                  const s = STATUS_STYLE[row.status as string] ?? { bg: "#f3f4f6", color: "#374151" };
                  const label = STATUS_OPTS.find(o => o.value === row.status)?.label ?? String(row.status);
                  return (
                    <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                      {label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">{(row.booking_ref as string) || "예약 참조 없음"}</p>
              <p className="text-lg font-bold">{formatCurrency(Number(row.total_amount ?? 0))}</p>
              <p className="text-xs text-muted-foreground">{row.issued_at ? formatDate(row.issued_at as string) : "미발행"}</p>
            </div>
          )}
          filterKey="status"
          filterLabel="상태"
          filterOptions={STATUS_OPTS}
          searchKeys={["invoice_no", "booking_ref"]}
          searchPlaceholder="인보이스 번호 / 예약 검색..."
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/invoices/${(row as { id: string }).id}`)}
          emptyIcon={<Receipt className="w-10 h-10" />}
          emptyMessage="인보이스가 없습니다"
        />
      </div>
    </DashboardLayout>
  );
}
