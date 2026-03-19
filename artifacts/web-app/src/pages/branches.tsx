import { useListBranches } from "@workspace/api-client-react";
import { Card, Button } from "@/components/ui";
import { Plus, MapPin, Phone, Globe } from "lucide-react";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";

type BranchRow = Record<string, unknown>;

function BranchCard({ branch }: { branch: BranchRow }) {
  return (
    <Card className="overflow-hidden flex flex-col group hover:border-primary/30 transition-colors">
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-white">{branch.name as string}</h3>
            <p className="text-primary text-sm font-medium">{branch.internalCode as string}</p>
          </div>
          <StatusBadge
            status={(branch.isActive as boolean) ? "active" : "inactive"}
            label={(branch.isActive as boolean) ? "Active" : "Inactive"}
          />
        </div>

        <div className="space-y-3 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-primary/70" />
            <span>{(branch.city as string) || "No city"}, {branch.country as string}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-primary/70" />
            <span>{(branch.phone as string) || "No phone"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-primary/70" />
            <span>{branch.timezone as string} • {branch.currency as string}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 p-4 bg-black/20 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm">Settings</Button>
        <Button variant="outline" size="sm">Edit</Button>
      </div>
    </Card>
  );
}

const BRANCH_COLUMNS: ColumnDef<BranchRow>[] = [
  { key: "name", label: "Name" },
  { key: "internalCode", label: "Code" },
  {
    key: "city",
    label: "City",
    render: (row) => <span>{(row.city as string) || "—"}</span>,
  },
  { key: "country", label: "Country" },
  {
    key: "isActive",
    label: "Status",
    render: (row) => (
      <StatusBadge
        status={(row.isActive as boolean) ? "active" : "inactive"}
        label={(row.isActive as boolean) ? "Active" : "Inactive"}
      />
    ),
  },
  { key: "timezone", label: "Timezone" },
  { key: "currency", label: "Currency" },
];

const BRANCH_STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

export default function Branches() {
  const { data: branchesData, isLoading } = useListBranches();
  const branches = (branchesData?.data || []) as unknown as BranchRow[];

  return (
    <ListPageWrapper
      title="Branch Management"
      subtitle="Manage physical locations and venue settings"
      data={branches}
      columns={BRANCH_COLUMNS}
      cardRenderer={(row) => <BranchCard branch={row} />}
      filterKey="isActive"
      filterLabel="Status"
      filterOptions={BRANCH_STATUS_OPTIONS}
      searchKeys={["name", "internalCode", "city", "country"]}
      searchPlaceholder="Search branches..."
      isLoading={isLoading}
      actions={
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Add Branch
        </Button>
      }
      emptyIcon={<MapPin className="w-10 h-10" />}
      emptyMessage="No branches found"
    />
  );
}
