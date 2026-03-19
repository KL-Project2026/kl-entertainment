import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { useListProductGroups, useListProductTypes, useListProducts, useListBranches } from "@workspace/api-client-react";
import { Card, Tabs } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Plus, Tag, Package as PackageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";

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
  {
    key: "unit",
    label: "Unit",
  },
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

export default function Products() {
  const { user } = useAuthStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId || null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

  const { data: branchesData } = useListBranches();

  useEffect(() => {
    if (!selectedBranchId && branchesData?.data && branchesData.data.length > 0) {
      setSelectedBranchId(branchesData.data[0].id);
    }
  }, [branchesData, selectedBranchId]);

  const { data: groupsData } = useListProductGroups();
  const groups = groupsData?.data || [];

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const { data: typesData } = useListProductTypes({ group_id: selectedGroupId }, { query: { enabled: !!selectedGroupId } });
  const types = typesData?.data || [];

  useEffect(() => {
    if (types.length > 0) {
      setSelectedTypeId(types[0].id);
    } else {
      setSelectedTypeId("");
    }
  }, [types]);

  const { data: productsData, isLoading } = useListProducts(
    {
      branch_id: selectedBranchId || undefined,
      type_id: selectedTypeId || undefined,
    },
    {
      query: { enabled: !!selectedTypeId },
    }
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
              <option key={b.id} value={b.id}>{b.name}</option>
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
        title="Product Catalog"
        subtitle="Manage inventory and pricing"
        data={allProducts}
        columns={PRODUCT_COLUMNS}
        cardRenderer={(row) => <ProductCard product={row} />}
        filterKey="isActive"
        filterLabel="Status"
        filterOptions={PRODUCT_STATUS_OPTIONS}
        searchKeys={["nameFlat"]}
        searchPlaceholder="Search products..."
        isLoading={isLoading}
        actions={
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        }
        emptyIcon={<PackageIcon className="w-10 h-10" />}
        emptyMessage="No products found in this category"
      />
    </div>
  );
}
