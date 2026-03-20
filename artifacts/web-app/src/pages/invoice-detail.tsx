import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, CreditCard, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FolioView } from "@/components/shared/FolioView";

const STATUS_COLORS: Record<string, string> = {
  paid:          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  partially_paid:"bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  issued:        "bg-blue-500/10 text-blue-400 border-blue-500/30",
  draft:         "bg-gray-500/10 text-gray-400 border-gray-500/30",
  void:          "bg-red-500/10 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "결제완료", partially_paid: "부분결제", issued: "발행", draft: "초안", void: "취소",
};

function InfoRow({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${accent ? "text-primary font-bold text-lg" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

interface InvData {
  invoice_no: string;
  booking_ref: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  issued_at: string | null;
  reservation_id: string | null;
}

interface PayData {
  id: string;
  amount: number;
  method: string;
  paid_at: string | null;
  ref_no: string | null;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const r = await fetch(`/api/invoices/${id}`);
      if (!r.ok) throw new Error("Not found");
      const d = await r.json();
      const raw = d.data ?? d;
      const rawInv = (raw.invoice ?? {}) as Record<string, unknown>;
      const rawPays = (raw.payments ?? []) as Record<string, unknown>[];

      const inv: InvData = {
        invoice_no:       String(rawInv.invoice_no ?? ""),
        booking_ref:      String(rawInv.booking_ref ?? "—"),
        status:           String(rawInv.status ?? "draft"),
        currency:         String(rawInv.currency ?? "MYR"),
        subtotal:         Number(rawInv.subtotal ?? 0),
        tax_amount:       Number(rawInv.tax_amount ?? 0),
        discount_amount:  Number(rawInv.discount_amount ?? 0),
        total_amount:     Number(rawInv.total_amount ?? 0),
        issued_at:        rawInv.issued_at != null ? String(rawInv.issued_at) : null,
        reservation_id:   rawInv.reservation_id != null ? String(rawInv.reservation_id) : null,
      };
      const pays: PayData[] = rawPays.map((p) => ({
        id:       String(p.id ?? ""),
        amount:   Number(p.amount ?? 0),
        method:   String(p.method ?? "—"),
        paid_at:  p.paid_at != null ? String(p.paid_at) : null,
        ref_no:   p.ref_no != null ? String(p.ref_no) : null,
      }));
      return { inv, pays };
    },
    enabled: !!id,
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

  if (error || !data?.inv) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>인보이스를 찾을 수 없습니다.</p>
          <Button variant="ghost" onClick={() => navigate("/invoices")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { inv, pays } = data;
  const status = inv.status;
  const statusColor = STATUS_COLORS[status] ?? "";
  const statusLabel = STATUS_LABELS[status] ?? status;

  const summaryRows: { label: string; value: string; accent?: boolean }[] = [
    { label: "소계",  value: formatCurrency(inv.subtotal) },
    { label: "세금",  value: formatCurrency(inv.tax_amount) },
    { label: "할인",  value: `-${formatCurrency(inv.discount_amount)}` },
    { label: "합계",  value: formatCurrency(inv.total_amount), accent: true },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/invoices")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-display font-bold font-mono">{inv.invoice_no}</h1>
                <Badge className={`border text-xs ${statusColor}`}>{statusLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                예약: {inv.booking_ref} · 발행: {inv.issued_at ? formatDate(inv.issued_at) : "미발행"}
              </p>
            </div>
          </div>
        </div>

        {/* 금액 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summaryRows.map(({ label, value, accent }) => (
            <Card key={label} className="p-4 bg-black/40 border-white/5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-lg font-display font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
            </Card>
          ))}
        </div>

        {/* 인보이스 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> 인보이스 정보
            </h3>
            <InfoRow label="Invoice No" value={inv.invoice_no} />
            <InfoRow label="예약 참조" value={inv.booking_ref} />
            <InfoRow label="발행일" value={inv.issued_at ? formatDate(inv.issued_at) : null} />
            <InfoRow label="통화" value={inv.currency} />
            <InfoRow label="합계" value={formatCurrency(inv.total_amount)} accent />
          </Card>

          {/* 결제 내역 */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> 결제 내역 ({pays.length}건)
            </h3>
            {pays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">결제 내역 없음</p>
            ) : (
              pays.map((p) => (
                <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 text-sm">
                  <div>
                    <p className="font-medium text-emerald-400">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {p.paid_at ? new Date(p.paid_at).toLocaleString("en-GB") : "—"}
                    </p>
                    {p.ref_no && <p className="text-xs text-muted-foreground font-mono">{p.ref_no}</p>}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Folio 항목 */}
        {inv.reservation_id && (
          <div>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Folio 항목
            </h3>
            <FolioView
              reservationId={inv.reservation_id}
              currency={inv.currency}
              isLive={false}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
