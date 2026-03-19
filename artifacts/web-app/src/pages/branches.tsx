import { useState } from "react";
import { useListBranches, useCreateBranch } from "@workspace/api-client-react";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Plus, Search, MapPin, Phone, Globe } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Branches() {
  const [search, setSearch] = useState("");
  const { data: branchesData, isLoading } = useListBranches();
  
  const branches = branchesData?.data || [];
  const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.internalCode.toLowerCase().includes(search.toLowerCase()));

  // We could implement the full create branch dialog here. Stubbing the button for visual completeness.
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Branch Management</h2>
          <p className="text-muted-foreground text-sm">Manage physical locations and venue settings</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Add Branch
        </Button>
      </div>

      <Card className="p-4 flex gap-4 bg-black/40 border-white/5">
        <div className="flex-1 max-w-md">
          <Input 
            placeholder="Search branches..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => (
            <Card key={branch.id} className="overflow-hidden flex flex-col group hover:border-primary/30 transition-colors">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">{branch.name}</h3>
                    <p className="text-primary text-sm font-medium">{branch.internalCode}</p>
                  </div>
                  <Badge variant={branch.isActive ? "success" : "neutral"}>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-3 mt-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-primary/70" />
                    <span>{branch.city || "No city"}, {branch.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-primary/70" />
                    <span>{branch.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary/70" />
                    <span>{branch.timezone} • {branch.currency}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/5 p-4 bg-black/20 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm">Settings</Button>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
