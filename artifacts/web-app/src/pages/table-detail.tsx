import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, BedDouble, Coffee, Grid2x2, Users,
  MapPin, Tag, Plus, Pencil, Trash2, DollarSign,
  ToggleLeft, ToggleRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface RoomTable {
  id: string; branch_id: string; branch_name: string;
  name: string; type: "ROOM" | "TABLE" | "BOOTH";
  capacity_min: number; capacity_max: number;
  description: string | null; amenities: string[];
  floor: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "OUT_OF_ORDER";
  image_urls: string[]; sort_order: number;
  pricing: PricingRule[];
}
interface PricingRule {
  id: string; room_table_id: string;
  price_label: string; price_type: "PER_HOUR" | "PER_SESSION" | "FLAT_RATE";
  base_price: string; currency_code: string;
  applicable_days: number;
  time_start: string | null; time_end: string | null;
  date_from: string | null; date_to: string | null;
  priority: number; is_active: boolean; notes: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  ROOM:  <BedDouble className="w-5 h-5" />,
  TABLE: <Coffee className="w-5 h-5" />,
  BOOTH: <Grid2x2 className="w-5 h-5" />,
};
const TYPE_COLORS: Record<string, string> = {
  ROOM:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  TABLE: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  BOOTH: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       "bg-green-500/20 text-green-300",
  INACTIVE:     "bg-gray-500/20 text-gray-400",
  MAINTENANCE:  "bg-yellow-500/20 text-yellow-300",
  OUT_OF_ORDER: "bg-red-500/20 text-red-300",
};
const PRICE_TYPE_LABELS: Record<string, string> = {
  PER_HOUR: "/ Hour", PER_SESSION: "/ Session", FLAT_RATE: "Flat Rate",
};
const DAY_BITS = [
  { bit: 1,  short: "M", label: "Mon" },
  { bit: 2,  short: "T", label: "Tue" },
  { bit: 4,  short: "W", label: "Wed" },
  { bit: 8,  short: "T", label: "Thu" },
  { bit: 16, short: "F", label: "Fri" },
  { bit: 32, short: "S", label: "Sat" },
  { bit: 64, short: "S", label: "Sun" },
];

function fmtDays(mask: number): string {
  if (mask === 127) return "Every day";
  if (mask === 31)  return "Mon – Fri";
  if (mask === 96)  return "Sat – Sun";
  return DAY_BITS.filter(d => (mask & d.bit) > 0).map(d => d.label).join(", ");
}
function fmtTime(t: string | null) { return t?.slice(0, 5) ?? ""; }

function DetailRow({ label, value }: { label: string; value?: string | null | number | React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

// ── Pricing Modal ──────────────────────────────────────────────────────────
interface PriceForm {
  id?: string;
  priceLabel: string; priceType: string; basePrice: string;
  applicableDays: number;
  timeStart: string; timeEnd: string;
  dateFrom: string; dateTo: string;
  priority: number; notes: string; isActive: boolean;
}
const EMPTY_PRICE: PriceForm = {
  priceLabel: "", priceType: "PER_HOUR", basePrice: "",
  applicableDays: 127,
  timeStart: "", timeEnd: "",
  dateFrom: "", dateTo: "",
  priority: 0, notes: "", isActive: true,
};

function PricingModal({
  initial, onClose, onSave,
}: {
  initial: PriceForm;
  onClose: () => void;
  onSave: (f: PriceForm) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PriceForm>(initial);
  const set = (k: keyof PriceForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial.id;

  function toggleDay(bit: number) {
    set("applicableDays", form.applicableDays ^ bit);
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("table_detail.edit_pricing_rule") : t("table_detail.add_pricing_rule")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("table_detail.label_required")}</Label>
              <Input className="mt-1" value={form.priceLabel}
                onChange={e => set("priceLabel", e.target.value)}
                placeholder={t("table_detail.label_placeholder")} />
            </div>
            <div>
              <Label>{t("table_detail.price_type_required")}</Label>
              <Select value={form.priceType} onValueChange={v => set("priceType", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_HOUR">{t("table_detail.per_hour")}</SelectItem>
                  <SelectItem value="PER_SESSION">{t("table_detail.per_session")}</SelectItem>
                  <SelectItem value="FLAT_RATE">{t("table_detail.flat_rate")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("table_detail.base_price_required")}</Label>
              <Input className="mt-1" type="number" min={0} step={0.01}
                value={form.basePrice} onChange={e => set("basePrice", e.target.value)}
                placeholder="120.00" />
            </div>
            <div>
              <Label>{t("table_detail.priority")}</Label>
              <Input className="mt-1" type="number" min={0}
                value={form.priority} onChange={e => set("priority", parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{t("table_detail.priority_hint")}</p>
            </div>
          </div>

          {/* Days of week */}
          <div>
            <Label>{t("table_detail.applicable_days")}</Label>
            <div className="flex gap-1.5 mt-2">
              {DAY_BITS.map(d => (
                <button key={d.bit} onClick={() => toggleDay(d.bit)}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-colors border
                    ${(form.applicableDays & d.bit) > 0
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30"}`}>
                  {d.short}
                </button>
              ))}
              <button onClick={() => set("applicableDays", 127)}
                className="ml-1 text-xs text-muted-foreground hover:text-white px-2 underline-offset-2 hover:underline">
                {t("table_detail.all")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{fmtDays(form.applicableDays)}</p>
          </div>

          {/* Time window */}
          <div>
            <Label>{t("table_detail.time_window")}</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("table_detail.from")}</p>
                <Input type="time" value={form.timeStart} onChange={e => set("timeStart", e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("table_detail.to")}</p>
                <Input type="time" value={form.timeEnd} onChange={e => set("timeEnd", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Date range override */}
          <div>
            <Label>{t("table_detail.date_range_override")}</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("table_detail.from")}</p>
                <DateInput value={form.dateFrom} onChange={e => set("dateFrom", e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("table_detail.to")}</p>
                <DateInput value={form.dateTo} onChange={e => set("dateTo", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label>{t("table_detail.notes")}</Label>
            <Input className="mt-1" value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder={t("table_detail.notes_placeholder")} />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <Label>{t("table_detail.active")}</Label>
              <button onClick={() => set("isActive", !form.isActive)}
                className={`transition-colors ${form.isActive ? "text-green-400" : "text-muted-foreground"}`}>
                {form.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
              <span className="text-sm text-muted-foreground">{form.isActive ? t("table_detail.active") : t("table_detail.inactive")}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(form)}
            disabled={!form.priceLabel.trim() || !form.basePrice || form.applicableDays === 0}>
            {isEdit ? t("table_detail.save_changes") : t("table_detail.add_rule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function TableDetail() {
  const { t } = useTranslation();
  const TAB_ITEMS: [string, string][] = [["info", t("table_detail.tab_info")], ["pricing", t("table_detail.tab_pricing")]];
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token } = useAuthStore();
  const authH = token ? { Authorization: `Bearer ${token}` } : {};
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("info");
  const [priceModal, setPriceModal] = useState<PriceForm | null>(null);

  const { data: roomData, isLoading, error } = useQuery({
    queryKey: ["room-table", id],
    queryFn: async () => {
      const r = await fetch(`/api/room-tables/${id}`, { headers: authH });
      if (!r.ok) throw new Error("Not found");
      const d = await r.json();
      return d.data as RoomTable;
    },
    enabled: !!id,
    retry: false,
  });
  const room = roomData;

  const addPriceMut = useMutation({
    mutationFn: async (f: PriceForm) => {
      const r = await fetch(`/api/room-tables/${id}/pricing`, {
        method: "POST", headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({
          priceLabel: f.priceLabel.trim(), priceType: f.priceType,
          basePrice: parseFloat(f.basePrice), applicableDays: f.applicableDays,
          timeStart: f.timeStart || null, timeEnd: f.timeEnd || null,
          dateFrom: f.dateFrom || null, dateTo: f.dateTo || null,
          priority: f.priority, notes: f.notes.trim() || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["room-table", id] }); setPriceModal(null); toast({ title: t("table_detail.rule_added") }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updatePriceMut = useMutation({
    mutationFn: async (f: PriceForm) => {
      const r = await fetch(`/api/room-tables/${id}/pricing/${f.id}`, {
        method: "PATCH", headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({
          priceLabel: f.priceLabel.trim(), priceType: f.priceType,
          basePrice: parseFloat(f.basePrice), applicableDays: f.applicableDays,
          timeStart: f.timeStart || null, timeEnd: f.timeEnd || null,
          dateFrom: f.dateFrom || null, dateTo: f.dateTo || null,
          priority: f.priority, notes: f.notes.trim() || null, isActive: f.isActive,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["room-table", id] }); setPriceModal(null); toast({ title: t("table_detail.rule_updated") }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePriceMut = useMutation({
    mutationFn: async (priceId: string) => {
      const r = await fetch(`/api/room-tables/${id}/pricing/${priceId}`, {
        method: "DELETE", headers: authH,
      });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["room-table", id] }); toast({ title: t("table_detail.rule_deleted") }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <DashboardLayout>
      <div className="p-6 space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-64 bg-white/5 rounded-xl" />
      </div>
    </DashboardLayout>
  );

  if (error || !room) return (
    <DashboardLayout>
      <div className="p-6 text-center py-20 text-muted-foreground">
        <p>{t("table_detail.not_found")}</p>
        <Button variant="ghost" onClick={() => navigate("/tables")} className="mt-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> {t("table_detail.back_to_list")}
        </Button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/tables")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border font-medium ${TYPE_COLORS[room.type]}`}>
              {TYPE_ICONS[room.type]} {room.type}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">{room.name}</h1>
              <p className="text-sm text-muted-foreground">{room.branch_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[room.status]}`}>
              {room.status.replace("_", " ")}
            </span>
            <span className="text-sm text-muted-foreground bg-white/5 px-3 py-1 rounded-full">
              {t("table_detail.pax_range", { min: room.capacity_min, max: room.capacity_max })}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid rgba(255,255,255,0.08)" }}>
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

        {/* ── INFO TAB ─────────────────────────────────────────────────── */}
        {activeTab === "info" && (
          <div className="space-y-5">
            <Card className="p-5 bg-black/40 border-white/5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-primary">
                <Tag className="w-4 h-4" /> {t("table_detail.basic_info")}
              </h3>
              <DetailRow label={t("table_detail.name")}      value={room.name} />
              <DetailRow label={t("table_detail.type")}      value={room.type} />
              <DetailRow label={t("table_detail.branch")}    value={room.branch_name} />
              <DetailRow label={t("table_detail.status")}    value={room.status.replace("_", " ")} />
              <DetailRow label={t("table_detail.capacity")}  value={t("table_detail.capacity_range", { min: room.capacity_min, max: room.capacity_max })} />
              {room.floor && <DetailRow label={t("table_detail.floor_level")} value={room.floor} />}
              {room.description && <DetailRow label={t("table_detail.description")} value={room.description} />}
            </Card>

            {room.amenities?.length > 0 && (
              <Card className="p-5 bg-black/40 border-white/5">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-primary">
                  <MapPin className="w-4 h-4" /> {t("table_detail.amenities")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {room.amenities.map(a => (
                    <span key={a} className="text-sm bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                      {a}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── PRICING TAB ──────────────────────────────────────────────── */}
        {activeTab === "pricing" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> {t("table_detail.pricing_rules")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("table_detail.higher_priority_wins")}
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setPriceModal({ ...EMPTY_PRICE })}>
                <Plus className="w-4 h-4" /> {t("table_detail.add_rule")}
              </Button>
            </div>

            {(!room.pricing || room.pricing.length === 0) ? (
              <div className="py-16 text-center text-muted-foreground border border-white/5 rounded-xl">
                <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>{t("table_detail.no_pricing_rules")}</p>
                <Button variant="ghost" size="sm" className="mt-3 gap-2"
                  onClick={() => setPriceModal({ ...EMPTY_PRICE })}>
                  <Plus className="w-4 h-4" /> {t("table_detail.add_first_rule")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {room.pricing.map(p => (
                  <div key={p.id}
                    className={`rounded-xl border p-4 transition-colors ${p.is_active ? "border-white/10 bg-black/40" : "border-white/5 bg-black/20 opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.price_label}</span>
                        {!p.is_active && (
                          <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">{t("table_detail.inactive")}</span>
                        )}
                        <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-muted-foreground">
                          {t("table_detail.priority_label", { n: p.priority })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPriceModal({
                          id: p.id, priceLabel: p.price_label, priceType: p.price_type,
                          basePrice: p.base_price, applicableDays: p.applicable_days,
                          timeStart: fmtTime(p.time_start), timeEnd: fmtTime(p.time_end),
                          dateFrom: p.date_from ?? "", dateTo: p.date_to ?? "",
                          priority: p.priority, notes: p.notes ?? "", isActive: p.is_active,
                        })}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-white">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(t("table_detail.delete_confirm"))) deletePriceMut.mutate(p.id); }}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("table_detail.rate")}</p>
                        <p className="font-bold text-primary">
                          MYR {parseFloat(p.base_price).toFixed(2)}
                          <span className="text-muted-foreground font-normal ml-1 text-xs">
                            {PRICE_TYPE_LABELS[p.price_type]}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("table_detail.days")}</p>
                        <p>{fmtDays(p.applicable_days)}</p>
                      </div>
                      {(p.time_start || p.time_end) && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t("table_detail.time")}</p>
                          <p>{fmtTime(p.time_start) || "00:00"} – {fmtTime(p.time_end) || "23:59"}</p>
                        </div>
                      )}
                      {(p.date_from || p.date_to) && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t("table_detail.date_override")}</p>
                          <p>{p.date_from ?? "—"} → {p.date_to ?? "—"}</p>
                        </div>
                      )}
                    </div>

                    {p.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">{p.notes}</p>
                    )}

                    {/* Day pills */}
                    <div className="flex gap-1 mt-3">
                      {DAY_BITS.map(d => (
                        <span key={d.bit}
                          className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold
                            ${(p.applicable_days & d.bit) > 0
                              ? "bg-primary/20 text-primary"
                              : "bg-white/5 text-muted-foreground/40"}`}>
                          {d.short}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {priceModal && (
        <PricingModal
          initial={priceModal}
          onClose={() => setPriceModal(null)}
          onSave={f => f.id ? updatePriceMut.mutate(f) : addPriceMut.mutate(f)}
        />
      )}
    </DashboardLayout>
  );
}
