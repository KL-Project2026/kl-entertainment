import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { useListProductGroups, useListProductTypes, useListProducts, useListBranches } from "@workspace/api-client-react";
import { Card, Tabs, Button, Badge } from "@/components/ui";
import { Plus, Search, Tag, Package as PackageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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

  const { data: typesData } = useListProductTypes({ group_id: selectedGroupId }, { query: { enabled: !!selectedGroupId }});
  const types = typesData?.data || [];

  useEffect(() => {
    if (types.length > 0) {
      setSelectedTypeId(types[0].id);
    } else {
      setSelectedTypeId("");
    }
  }, [types]);

  const { data: productsData, isLoading } = useListProducts({ 
    branch_id: selectedBranchId || undefined, 
    type_id: selectedTypeId || undefined 
  }, { 
    query: { enabled: !!selectedTypeId }
  });

  const products = productsData?.data || [];

  return (
    <div className="space-y-8 flex flex-col h-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Product Catalog</h2>
          <p className="text-muted-foreground text-sm">Manage inventory and pricing</p>
        </div>
        <div className="flex gap-4">
          {user?.role === 'super_admin' && branchesData?.data && (
             <select 
               value={selectedBranchId || ""} 
               onChange={e => setSelectedBranchId(e.target.value)}
               className="bg-card border border-white/5 rounded-lg px-4 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
             >
               {branchesData.data.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          )}
          <Button className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
        </div>
      </div>

      <div className="bg-card/50 border border-white/5 rounded-2xl p-2 flex flex-wrap gap-2 backdrop-blur-md">
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
              selectedGroupId === group.id 
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.3)]" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {group.name.en}
          </button>
        ))}
      </div>

      {types.length > 0 && (
        <div className="flex gap-2 pb-2 overflow-x-auto">
          <Tabs 
            tabs={types.map(t => ({ id: t.id, label: t.name.en }))}
            activeTab={selectedTypeId}
            onChange={setSelectedTypeId}
          />
        </div>
      )}

      <div className="flex-1 overflow-auto pb-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/5 rounded-2xl bg-black/20">
            <PackageIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="p-5 hover:border-primary/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Tag className="w-5 h-5" />
                  </div>
                  <Badge variant={product.isActive ? "success" : "neutral"} className="scale-90 origin-top-right">
                    {product.isActive ? "Active" : "Hidden"}
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-lg text-white mb-1 truncate" title={product.name.en}>{product.name.en}</h3>
                {product.name.zh && <p className="text-xs text-muted-foreground mb-4">{product.name.zh}</p>}
                
                <div className="flex items-end justify-between mt-auto pt-4 border-t border-white/5">
                  <div>
                    <p className="text-2xl font-bold font-display text-primary">{formatCurrency(product.unitPrice)}</p>
                    <p className="text-xs text-muted-foreground">per {product.unit}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
