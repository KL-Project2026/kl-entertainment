import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { useListProductGroups, useListProductTypes, useListProducts, useListBranches } from "@workspace/api-client-react";
import { Card, Tabs } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Tag, Package as PackageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";

type ProductRow = Record<string, unknown>;

function ProductCard({ product }: { product: ProductRow }) {
  const name = product.name as { en?: string; zh?: string };
  return (
    <Card className="p-5 hover:border-primary/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
          <Tag className="w-5 h-5" />
        </div>
        <StatusBadge
          status={(product.isActive as boolean) ? "active" : "inactive"}
          label={(product.isActive as boolean) ? "Active" : "Hidden"}
        />
      </div>
      <h3 className="font-semibold text-lg text-white mb-1 truncate" title={name?.en}>
        {name?.en || "—"}
      </h3>
      {name?.zh && <p className="text-xs text-muted-foreground mb-4">{name.zh}</p>}
      <div className="flex items-end justify-between mt-auto pt-4 border-t border-white/5">
        <div>
          <p className="text-2xl font-bold font-display text-primary">
            {formatCurrency(product.unitPrice as number)}
          </p>
          <p className="text-xs text-muted-foreground">per {product.unit as string}</p>
        </div>
      </div>
    </Card>
  );
}

const PRODUCT_COLUMNS: ColumnDef<ProductRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (row) => {
      const name = row.name as { en?: string; zh?: string };
      return (
        <div>
          <p className="font-medium">{name?.en || "—"}</p>
          {name?.zh && <p className="text-xs text-muted-foreground">{name.zh}</p>}
        </div>
      );
    },
  },
  {
    key: "unitPrice",
    label: "Price",
    render: (row) => <span>{formatCurrency(row.unitPrice as number)}</span>,
  },
  { key: "unit", label: "Unit" },
  {
    key: "isActive",
    label: "Status",
    render: (row) => (
      <StatusBadge
        status={(row.isActive as boolean) ? "active" : "inactive"}
        label={(row.isActive as boolean) ? "Active" : "Hidden"}
      />
    ),
  },
];

const PRODUCT_STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Hidden" },
];

// ── Add Product Modal ─────────────────────────────────────────────────────────
interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branches: { id: string; name: string }[];
  userRole?: string;
  userBranchId?: string | null;
}

function AddProductModal({ open, onClose, onSuccess, branches, userRole, userBranchId }: AddProductModalProps) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [groupId, setGroupId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [taxApplicable, setTaxApplicable] = useState(true);
  const [branchId, setBranchId] = useState(userBranchId ?? "");
  const [sortOrder, setSortOrder] = useState("0");

  const { data: groupsData } = useListProductGroups();
  const groups = groupsData?.data || [];

  const { data: typesData } = useListProductTypes(
    { group_id: groupId },
    { query: { enabled: !!groupId } }
  );
  const types = typesData?.data || [];

  useEffect(() => {
    if (groups.length > 0 && !groupId) setGroupId(groups[0].id);
  }, [groups, groupId]);

  useEffect(() => {
    if (types.length > 0) setTypeId(types[0].id);
    else setTypeId("");
  }, [types]);

  function reset() {
    setGroupId(""); setTypeId(""); setNameEn(""); setNameZh("");
    setSku(""); setUnitPrice(""); setUnit("pcs");
    setTaxApplicable(true); setBranchId(userBranchId ?? ""); setSortOrder("0");
  }

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const body = {
        typeId,
        branchId: branchId || null,
        name: { en: nameEn.trim(), ...(nameZh.trim() ? { zh: nameZh.trim() } : {}) },
        sku: sku.trim() || null,
        unitPrice: parseFloat(unitPrice),
        unit: unit.trim() || "pcs",
        taxApplicable,
        sortOrder: parseInt(sortOrder) || 0,
      };
      const r = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Product added" });
      void queryClient.invalidateQueries({ queryKey: ["listProducts"] });
      reset();
      onSuccess();
      onClose();
    },
    onError: () => toast({ title: "Failed to add product", variant: "destructive" }),
  });

  const isAdmin = ["super_admin", "admin"].includes(userRole ?? "");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg bg-[#0c0c10] border border-white/10">
        <DialogHeader>
          <DialogTitle>Add Menu Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {(g.name as { en?: string }).en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={typeId} onValueChange={setTypeId} disabled={!groupId || types.length === 0}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {(t.name as { en?: string }).en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (EN) <span className="text-destructive">*</span></Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Tiger Beer"
                className="bg-black/30 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name (ZH)</Label>
              <Input
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                placeholder="e.g. 老虎啤酒"
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. BEV-BEER-01"
              className="bg-black/30 border-white/10"
            />
          </div>

          {/* Price + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit Price (MYR) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="bg-black/30 border-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs / bottle / can"
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          {/* Tax + Sort */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tax Applicable</Label>
              <Select
                value={taxApplicable ? "true" : "false"}
                onValueChange={(v) => setTaxApplicable(v === "true")}
              >
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          {/* Branch — admin only */}
          {isAdmin && branches.length > 0 && (
            <div className="space-y-1.5">
              <Label>Branch <span className="text-muted-foreground text-xs">(leave blank for all branches)</span></Label>
              <Select value={branchId || "__none__"} onValueChange={(v) => setBranchId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => create()}
            disabled={isPending || !typeId || !nameEn.trim() || !unitPrice}
          >
            {isPending ? "Adding…" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Products() {
  const { user } = useAuthStore();
  const [, navigate] = useLocation();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId || null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: branchesData } = useListBranches();
  const branches = (branchesData?.data || []).map((b) => ({ id: b.id, name: b.name as string }));

  useEffect(() => {
    if (!selectedBranchId && branchesData?.data && branchesData.data.length > 0) {
      setSelectedBranchId(branchesData.data[0].id);
    }
  }, [branchesData, selectedBranchId]);

  const { data: groupsData } = useListProductGroups();
  const groups = groupsData?.data || [];

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const { data: typesData } = useListProductTypes(
    { group_id: selectedGroupId },
    { query: { enabled: !!selectedGroupId } }
  );
  const types = typesData?.data || [];

  useEffect(() => {
    if (types.length > 0) setSelectedTypeId(types[0].id);
    else setSelectedTypeId("");
  }, [types]);

  const { data: productsData, isLoading } = useListProducts(
    {
      branch_id: selectedBranchId || undefined,
      type_id: selectedTypeId || undefined,
    },
    { query: { enabled: !!selectedTypeId } }
  );

  const allProducts = (productsData?.data || []).map((p) => ({
    ...p,
    nameFlat: [(p.name as { en?: string; zh?: string })?.en, (p.name as { en?: string; zh?: string })?.zh]
      .filter(Boolean)
      .join(" "),
  })) as unknown as ProductRow[];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Branch selector for super_admin */}
      {user?.role === "super_admin" && branchesData?.data && (
        <div className="flex justify-end">
          <select
            value={selectedBranchId || ""}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-card border border-white/5 rounded-lg px-4 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          >
            {branchesData.data.map((b) => (
              <option key={b.id} value={b.id}>{b.name as string}</option>
            ))}
          </select>
        </div>
      )}

      {/* Group tabs */}
      <div className="bg-card/50 border border-white/5 rounded-2xl p-2 flex flex-wrap gap-2 backdrop-blur-md">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              selectedGroupId === group.id
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {(group.name as { en?: string }).en}
          </button>
        ))}
      </div>

      {/* Type tabs */}
      {types.length > 0 && (
        <div className="flex gap-2 pb-2 overflow-x-auto">
          <Tabs
            tabs={types.map((t) => ({ id: t.id, label: (t.name as { en?: string }).en || t.id }))}
            activeTab={selectedTypeId}
            onChange={setSelectedTypeId}
          />
        </div>
      )}

      <ListPageWrapper
        title="Menu"
        subtitle="Manage menu items and pricing"
        data={allProducts}
        columns={PRODUCT_COLUMNS}
        cardRenderer={(row) => <ProductCard product={row} />}
        filterKey="isActive"
        filterLabel="Status"
        filterOptions={PRODUCT_STATUS_OPTIONS}
        searchKeys={["nameFlat"]}
        searchPlaceholder="Search items..."
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/products/${row.id as string}`)}
        actions={
          <Button className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        }
        emptyIcon={<PackageIcon className="w-10 h-10" />}
        emptyMessage="No items found in this category"
      />

      <AddProductModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["listProducts"] })}
        branches={branches}
        userRole={user?.role}
        userBranchId={user?.branchId}
      />
    </div>
  );
}

