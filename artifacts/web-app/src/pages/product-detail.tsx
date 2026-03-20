import { useState, useEffect } from "react";
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
      toast({ title: "Changes saved" });
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
      void queryClient.invalidateQueries({ queryKey: ["listProducts"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
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
      toast({ title: data.data.isActive ? "Item set to Active" : "Item set to Hidden" });
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
      void queryClient.invalidateQueries({ queryKey: ["listProducts"] });
    },
    onError: () => toast({ title: "Failed to toggle status", variant: "destructive" }),
  });

  // ── Render helpers ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }
  if (isError || !product) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Menu item not found.</p>
          <Button variant="outline" onClick={() => navigate("/products")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Menu
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
              {product.isActive ? "Active" : "Hidden"}
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
                ? <><EyeOff className="w-4 h-4" /> Hide</>
                : <><Eye className="w-4 h-4" /> Show</>
              }
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ── Left column: info chips ─────────────────────────────────── */}
          <div className="md:col-span-1 space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Item Info</h2>

              <InfoRow icon={<Layers className="w-4 h-4 text-primary/70" />} label="Category">
                {product.groupName ?? "—"}
              </InfoRow>
              <InfoRow icon={<Tag className="w-4 h-4 text-primary/70" />} label="Type">
                {product.typeName ?? "—"}
              </InfoRow>
              <InfoRow icon={<Building2 className="w-4 h-4 text-primary/70" />} label="Branch">
                {product.branchName ? String(product.branchName) : "All branches"}
              </InfoRow>
              <InfoRow icon={<Hash className="w-4 h-4 text-primary/70" />} label="SKU">
                {product.sku || "—"}
              </InfoRow>

              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-muted-foreground">Current price</p>
                <p className="text-2xl font-bold font-display text-primary mt-0.5">
                  {formatCurrency(product.unitPrice)}
                </p>
                <p className="text-xs text-muted-foreground">per {product.unit}</p>
              </div>

              <div className="text-xs text-muted-foreground pt-1 border-t border-white/5">
                Added {new Date(product.createdAt).toLocaleDateString("en-MY", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </div>
            </Card>
          </div>

          {/* ── Right column: edit form ─────────────────────────────────── */}
          <Card className="md:col-span-2 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Edit Details</h2>

            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-name-en">Name (EN) <span className="text-destructive">*</span></Label>
                <Input
                  id="pd-name-en"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="bg-black/30 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-name-zh">Name (ZH)</Label>
                <Input
                  id="pd-name-zh"
                  value={nameZh}
                  onChange={(e) => setNameZh(e.target.value)}
                  placeholder="Chinese name"
                  className="bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="pd-desc">Description</Label>
              <Input
                id="pd-desc"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                placeholder="Short description (optional)"
                className="bg-black/30 border-white/10"
              />
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <Label htmlFor="pd-sku">SKU</Label>
              <Input
                id="pd-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. BEV-BEER-01"
                className="bg-black/30 border-white/10"
              />
            </div>

            {/* Price + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pd-price">Unit Price (MYR) <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="pd-unit">Unit</Label>
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
                <Label htmlFor="pd-tax">Tax Applicable</Label>
                <Select
                  value={taxApplicable ? "true" : "false"}
                  onValueChange={(v) => setTaxApplicable(v === "true")}
                >
                  <SelectTrigger id="pd-tax" className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-sort">Sort Order</Label>
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
                {saving ? "Saving…" : "Save Changes"}
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
