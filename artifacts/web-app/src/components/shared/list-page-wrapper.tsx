import { useState, useMemo, ReactNode } from "react";
import { Search, LayoutGrid, Table2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface ListPageWrapperProps<T extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: ColumnDef<T>[];
  cardRenderer: (row: T) => ReactNode;
  filterKey?: keyof T;
  filterLabel?: string;
  filterOptions?: FilterOption[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  actions?: ReactNode;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
}

const ALL_VALUE = "__all__";

export function ListPageWrapper<T extends Record<string, unknown>>({
  title,
  subtitle,
  data,
  columns,
  cardRenderer,
  filterKey,
  filterLabel = "Status",
  filterOptions,
  searchKeys,
  searchPlaceholder = "Search...",
  onRowClick,
  isLoading = false,
  onAddNew,
  addNewLabel = "Add New",
  actions,
  emptyIcon,
  emptyMessage = "No records found",
}: ListPageWrapperProps<T>) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState(ALL_VALUE);

  const filtered = useMemo(() => {
    let result = data;

    if (searchQuery.trim() && searchKeys && searchKeys.length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((key) => {
          const val = row[key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    if (filterKey && filterValue !== ALL_VALUE) {
      result = result.filter((row) => {
        const val = row[filterKey];
        return String(val) === filterValue;
      });
    }

    return result;
  }, [data, searchQuery, searchKeys, filterKey, filterValue]);

  const handleClear = () => {
    setSearchQuery("");
    setFilterValue(ALL_VALUE);
  };

  const hasClearable = searchQuery.trim() !== "" || filterValue !== ALL_VALUE;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors",
                viewMode === "card"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-white/5 text-muted-foreground"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-white/5 text-muted-foreground"
              )}
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          {actions}
          {onAddNew && (
            <Button onClick={onAddNew} className="gap-2">
              {addNewLabel}
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 bg-black/40 border-white/5 items-center">
        <div className="flex-1 min-w-[180px] max-w-xs relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filterKey && filterOptions && filterOptions.length > 0 && (
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-44 bg-black/30">
              <SelectValue placeholder={`All ${filterLabel}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All {filterLabel}</SelectItem>
              {filterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>

        {hasClearable && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </Card>

      {isLoading ? (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-black/40">
          {emptyIcon && <div className="flex justify-center mb-3 text-muted-foreground/30">{emptyIcon}</div>}
          <p className="text-muted-foreground">{emptyMessage}</p>
          {hasClearable && (
            <Button variant="outline" onClick={handleClear} className="mt-4 gap-2">
              <X className="w-4 h-4" /> Clear Filters
            </Button>
          )}
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((row, idx) => (
            <div
              key={(row.id as string) ?? idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {cardRenderer(row)}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-left text-xs text-muted-foreground">
                {columns.map((col) => (
                  <th key={col.key} className={cn("px-4 py-3 font-medium", col.className)}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr
                  key={(row.id as string) ?? idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-white/5 transition-colors hover:bg-white/5 text-sm",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.render
                        ? col.render(row)
                        : (() => {
                            const val = row[col.key];
                            return val !== null && val !== undefined ? String(val) : "—";
                          })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
