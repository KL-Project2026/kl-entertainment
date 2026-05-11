import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  ArrowLeft, Package, Tag, Building2, Layers, Hash,
  ToggleLeft, ToggleRight, Save, Eye, EyeOff,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  typeId: string | null;
  typeName: string | null;
  groupId: string | null;
  groupName: string | null;
  branchId: string | null;
  branchName: string | null;
  sku: string | null;
  name: { en?: string; zh?: string } | null;
  description: { en?: string } | null;
  unitPrice: number;
  unit: string;
  taxApplicable: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const authH = { Authorization: `Bearer ${token}` };

  // Form state
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [descEn, setDescEn] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [taxApplicable, setTaxApplicable] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  // ── Fetch product ──────────────────────────────────────────────────────────
  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const r = await fetch(`/api/products/${id}`, { headers: authH });
      if (!r.ok) throw new Error("Not found");
      const json = await r.json() as { data: Product };
      return json.data;
    },
  });

  // Populate form when data arrives
  useEffect(() => {
    if (!product) return;
    setNameEn(product.name?.en ?? "");
    setNameZh(product.name?.zh ?? "");
    setDescEn(product.description?.en ?? "");
    setSku(product.sku ?? "");
    setUnitPrice(String(product.unitPrice));
    setUnit(product.unit ?? "pcs");
    setTaxApplicable(product.taxApplicable);
    setSortOrder(String(product.sortOrder));
  }, [product]);

  // ── Save mutation ──────────────────────────────────────────────────────────
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      const body = {
        name: { en: nameEn.trim(), ...(nameZh.trim() ? { zh: nameZh.trim() } : {}) },
        description: descEn.trim() ? { en: descEn.trim() } : null,
        sku: sku.trim() || null,
        unitPrice: parseFloat(unitPrice),
        unit: unit.trim() || "pcs",
        taxApplicable,
        sortOrder: parseInt(sortOrder) || 0,
      };
      const r = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: t("product_detail.changes_saved") });
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
      void queryClient.invalidateQueries({ queryKey: ["listProducts"] });
    },
    onError: () => toast({ title: t("product_detail.save_failed"), variant: "destructive" }),
  });

  // ── Toggle active mutation ─────────────────────────────────────────────────
  const { mutate: toggleActive, isPending: toggling } = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/products/${id}/toggle`, {
        method: "PUT",
        headers: authH,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data: { data: Product }) => {
      toast({ title: data.data.isActive ? t("product_detail.set_active") : t("product_detail.set_hidden") });
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
      void queryClient.invalidateQueries({ queryKey: ["listProducts"] });
    },
    onError: () => toast({ title: t("product_detail.toggle_failed"), variant: "destructive" }),
  });

  // ── Render helpers ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">{t("product_detail.loading")}</div>
      </DashboardLayout>
    );
  }
  if (isError || !product) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">{t("product_detail.not_found")}</p>
          <Button variant="outline" onClick={() => navigate("/products")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("product_detail.back_to_menu")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isDirty =
    nameEn !== (product.name?.en ?? "") ||
    nameZh !== (product.name?.zh ?? "") ||
    descEn !== (product.description?.en ?? "") ||
    sku !== (product.sku ?? "") ||
    unitPrice !== String(product.unitPrice) ||
    unit !== product.unit ||
    taxApplicable !== product.taxApplicable ||
    sortOrder !== String(product.sortOrder);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/products")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-xl md:text-2xl text-foreground truncate">
                {product.name?.en || "—"}
              </h1>
              {product.name?.zh && (
                <p className="text-sm text-muted-foreground">{product.name.zh}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Active / Hidden badge */}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              product.isActive
                ? "bg-green-500/15 text-green-400 border border-green-500/20"
                : "bg-gray-500/15 text-gray-400 border border-gray-500/20"
            }`}>
              {product.isActive ? t("product_detail.active") : t("product_detail.hidden")}
            </span>

            {/* Toggle button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleActive()}
              disabled={toggling}
              className="gap-1.5"
            >
              {product.isActive
                ? <><EyeOff className="w-4 h-4" /> {t("product_detail.hide")}</>
                : <><Eye className="w-4 h-4" /> {t("product_detail.show")}</>
              }
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ── Left column: info chips ─────────────────────────────────── */}
          <div className="md:col-span-1 space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">{t("product_detail.item_info")}</h2>

              <InfoRow icon={<Layers className="w-4 h-4 text-primary/70" />} label={t("product_detail.category")}>
                {product.groupName ?? "—"}
              </InfoRow>
              <InfoRow icon={<Tag className="w-4 h-4 text-primary/70" />} label={t("product_detail.type")}>
                {product.typeName ?? "—"}
              </InfoRow>
              <InfoRow icon={<Building2 className="w-4 h-4 text-primary/70" />} label={t("product_detail.branch")}>
                {product.branchName ? String(product.branchName) : t("product_detail.all_branches")}
              </InfoRow>
              <InfoRow icon={<Hash className="w-4 h-4 text-primary/70" />} label={t("product_detail.sku")}>
                {product.sku || "—"}
              </InfoRow>

              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-muted-foreground">{t("product_detail.current_price")}</p>
                <p className="text-2xl font-bold font-display text-primary mt-0.5">
                  {formatCurrency(product.unitPrice)}
                </p>
                <p className="text-xs text-muted-foreground">{t("product_detail.per_unit", { unit: product.unit })}</p>
              </div>

              <div className="text-xs text-muted-foreground pt-1 border-t border-white/5">
                {t("product_detail.added_on", { date: new Date(product.createdAt).toLocaleDateString("en-MY", {
                  year: "numeric", month: "short", day: "numeric",
                }) })}
              </div>
            </Card>
          </div>

          {/* ── Right column: edit form ─────────────────────────────────── */}
          <Card className="md:col-span-2 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">{t("product_detail.edit_details")}</h2>

            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-name-en">{t("product_detail.name_en")} <span className="text-destructive">*</span></Label>
                <Input
                  id="pd-name-en"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="bg-black/30 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-name-zh">{t("product_detail.name_zh")}</Label>
                <Input
                  id="pd-name-zh"
                  value={nameZh}
                  onChange={(e) => setNameZh(e.target.value)}
                  placeholder={t("product_detail.chinese_name")}
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="pd-desc">{t("product_detail.description")}</Label>
              <Input
                id="pd-desc"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                placeholder={t("product_detail.short_description")}
                className="bg-black/30 border-white/10"
              />
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <Label htmlFor="pd-sku">{t("product_detail.sku")}</Label>
              <Input
                id="pd-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={t("product_detail.sku_placeholder")}
                className="bg-black/30 border-white/10"
              />
            </div>

            {/* Price + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-price">{t("product_detail.unit_price")} <span className="text-destructive">*</span></Label>
                <Input
                  id="pd-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="bg-black/30 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-unit">{t("product_detail.unit")}</Label>
                <Input
                  id="pd-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Tax + Sort */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-tax">{t("product_detail.tax_applicable")}</Label>
                <Select
                  value={taxApplicable ? "true" : "false"}
                  onValueChange={(v) => setTaxApplicable(v === "true")}
                >
                  <SelectTrigger id="pd-tax" className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("product_detail.yes")}</SelectItem>
                    <SelectItem value="false">{t("product_detail.no")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-sort">{t("product_detail.sort_order")}</Label>
                <Input
                  id="pd-sort"
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2 border-t border-white/5">
              <Button
                onClick={() => save()}
                disabled={saving || !isDirty || !nameEn.trim()}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? t("product_detail.saving") : t("product_detail.save_changes")}
              </Button>
            </div>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────
function InfoRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-medium truncate">{children}</p>
      </div>
    </div>
  );
}
