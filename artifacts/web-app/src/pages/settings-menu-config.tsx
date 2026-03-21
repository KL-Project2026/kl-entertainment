import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Plus, Pencil, ChevronUp, ChevronDown, Tag,
  ToggleLeft, ToggleRight, Eye, EyeOff, Settings2, Layers, BookOpen,
  GitBranch, RotateCcw, Shield, ScrollText, Filter, ChevronRight,
  User, Clock, MapPin,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: { en?: string; zh?: string };
  icon: string;
  sortOrder: number;
  isActive: boolean;
  taxRateOverride: number | null;
  commissionDefaultRate: number;
  commissionDefaultFlat: number;
  notes: string | null;
  typeCount: number;
  itemCount: number;
  menuCategoryId: string | null;
  menuCatName: string | null;
  menuCatVisibilityLevel: "ALL" | "MANAGER_ONLY" | "ADMIN_ONLY" | null;
}

interface SubType {
  id: string;
  groupId: string;
  name: { en?: string; zh?: string };
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
}

interface BranchOverride {
  branchId: string;
  branchName: string;
  isVisible: boolean;
  sortOrderOverride: number | null;
  overrideId: string | null;
}

interface BranchCatOverride {
  id: string;
  name: { en?: string; zh?: string };
  icon: string;
  sortOrder: number;
  globalIsActive: boolean;
  effectiveVisible: boolean;
  overrideIsVisible: boolean | null;
  hasOverride: boolean;
  overrideId: string | null;
  typeCount: number;
  itemCount: number;
}

interface Branch {
  id: string;
  name: string;
}

interface MenuCat {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  visibilityLevel: "ALL" | "MANAGER_ONLY" | "ADMIN_ONLY";
  invoiceDisplayMode: "REAL_NAME" | "MASKED_CODE" | "MASKED_SYMBOL" | "CUSTOM_ALIAS";
  invoiceAlias: string | null;
  itemCount: number;
}

interface MenuCatEdits {
  name?: string;
  visibilityLevel?: string;
  invoiceDisplayMode?: string;
  invoiceAlias?: string;
}

// ── API base url ──────────────────────────────────────────────────────────────
const BASE = "/api/settings/menu-config";

// ── Category Form Modal ───────────────────────────────────────────────────────
interface CatModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  authH: Record<string, string>;
  editing: Category | null;
}

function CategoryModal({ open, onClose, onSaved, authH, editing }: CatModalProps) {
  const { toast } = useToast();
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [icon, setIcon] = useState("🍽️");
  const [taxRate, setTaxRate] = useState("");
  const [commRate, setCommRate] = useState("");
  const [commFlat, setCommFlat] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editing) {
      setNameEn(editing.name?.en ?? "");
      setNameZh(editing.name?.zh ?? "");
      setIcon(editing.icon ?? "🍽️");
      setTaxRate(editing.taxRateOverride != null ? String(Math.round(editing.taxRateOverride * 100 * 10) / 10) : "");
      setCommRate(editing.commissionDefaultRate ? String(Math.round(editing.commissionDefaultRate * 100 * 10) / 10) : "");
      setCommFlat(editing.commissionDefaultFlat ? String(editing.commissionDefaultFlat) : "");
      setNotes(editing.notes ?? "");
    } else {
      setNameEn(""); setNameZh(""); setIcon("🍽️");
      setTaxRate(""); setCommRate(""); setCommFlat(""); setNotes("");
    }
  }, [editing, open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const body = {
        name: { en: nameEn.trim(), ...(nameZh.trim() ? { zh: nameZh.trim() } : {}) },
        icon: icon.trim() || "🍽️",
        taxRateOverride: taxRate !== "" ? parseFloat(taxRate) / 100 : null,
        commissionDefaultRate: commRate !== "" ? parseFloat(commRate) / 100 : 0,
        commissionDefaultFlat: commFlat !== "" ? parseFloat(commFlat) : 0,
        notes: notes.trim() || null,
      };
      const url = editing ? `${BASE}/categories/${editing.id}` : `${BASE}/categories`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as Record<string, string>;
        throw Object.assign(new Error(err.message ?? "Failed"), { code: err.error });
      }
    },
    onSuccess: () => { toast({ title: editing ? "Category updated" : "Category created" }); onSaved(); onClose(); },
    onError: (err: Error & { code?: string }) => {
      const msg = err.code === "CATEGORY_NAME_DUPLICATE" ? err.message
        : err.code === "INVALID_TAX_RATE"    ? err.message
        : err.code === "INVALID_COMMISSION"  ? err.message
        : "Failed to save category";
      toast({ title: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-[#0c0c10] border border-white/10">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[60px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">Icon</Label>
              <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)}
                className="bg-black/30 border-white/10 text-center text-xl px-2" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name-en">Name (EN) <span className="text-destructive">*</span></Label>
              <Input id="cat-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Beverages" className="bg-black/30 border-white/10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-name-zh">Name (ZH)</Label>
            <Input id="cat-name-zh" value={nameZh} onChange={(e) => setNameZh(e.target.value)}
              placeholder="e.g. 饮料" className="bg-black/30 border-white/10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-tax">Tax Override (%)</Label>
              <Input id="cat-tax" type="number" min="0" max="100" step="0.1"
                value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                placeholder="e.g. 6" className="bg-black/30 border-white/10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-comm-r">Commission (%)</Label>
              <Input id="cat-comm-r" type="number" min="0" max="100" step="0.1"
                value={commRate} onChange={(e) => { setCommRate(e.target.value); setCommFlat(""); }}
                placeholder="e.g. 10" className="bg-black/30 border-white/10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-comm-f">Comm. Flat (MYR)</Label>
              <Input id="cat-comm-f" type="number" min="0" step="0.01"
                value={commFlat} onChange={(e) => { setCommFlat(e.target.value); setCommRate(""); }}
                placeholder="0.00" className="bg-black/30 border-white/10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-notes">Notes</Label>
            <Input id="cat-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (optional)" className="bg-black/30 border-white/10" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !nameEn.trim()}>
            {isPending ? "Saving…" : editing ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-type Form Modal ───────────────────────────────────────────────────────
interface TypeModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  authH: Record<string, string>;
  categoryId: string;
  editing: SubType | null;
}

function TypeModal({ open, onClose, onSaved, authH, categoryId, editing }: TypeModalProps) {
  const { toast } = useToast();
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => {
    if (editing) {
      setNameEn(editing.name?.en ?? "");
      setNameZh(editing.name?.zh ?? "");
      setSortOrder(String(editing.sortOrder));
    } else { setNameEn(""); setNameZh(""); setSortOrder("0"); }
  }, [editing, open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const body = {
        name: { en: nameEn.trim(), ...(nameZh.trim() ? { zh: nameZh.trim() } : {}) },
        sortOrder: parseInt(sortOrder) || 0,
      };
      const url = editing ? `${BASE}/types/${editing.id}` : `${BASE}/categories/${categoryId}/types`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as Record<string, string>;
        throw Object.assign(new Error(err.message ?? "Failed"), { code: err.error });
      }
    },
    onSuccess: () => { toast({ title: editing ? "Sub-type updated" : "Sub-type created" }); onSaved(); onClose(); },
    onError: (err: Error & { code?: string }) => {
      const msg = err.code === "SUBTYPE_NAME_DUPLICATE" ? err.message : "Failed to save sub-type";
      toast({ title: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-[#0c0c10] border border-white/10">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Sub-type" : "New Sub-type"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="type-name-en">Name (EN) <span className="text-destructive">*</span></Label>
            <Input id="type-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Beer" className="bg-black/30 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-name-zh">Name (ZH)</Label>
            <Input id="type-name-zh" value={nameZh} onChange={(e) => setNameZh(e.target.value)}
              placeholder="e.g. 啤酒" className="bg-black/30 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-sort">Sort Order</Label>
            <Input id="type-sort" type="number" min="0" value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)} className="bg-black/30 border-white/10" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !nameEn.trim()}>
            {isPending ? "Saving…" : editing ? "Save Changes" : "Create Sub-type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Audit Log helpers ─────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: { en?: string } | null;
  branchId: string | null;
  branchName: string | null;
  changedBy: string;
  changedByName: string;
  changedByRole: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  CATEGORY_CREATED:           { label: "Created",          color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  CATEGORY_UPDATED:           { label: "Updated",          color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20"  },
  CATEGORY_DEACTIVATED:       { label: "Deactivated",      color: "text-gray-400",   bg: "bg-gray-400/10 border-gray-400/20"  },
  SUBTYPE_CREATED:            { label: "Sub-type Created",  color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  SUBTYPE_UPDATED:            { label: "Sub-type Updated",  color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20"  },
  SUBTYPE_DEACTIVATED:        { label: "Sub-type Deactivated", color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" },
  SORT_ORDER_CHANGED:         { label: "Reordered",         color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-400/20" },
  BRANCH_VISIBILITY_CHANGED:  { label: "Branch Visibility", color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/20" },
  BRANCH_OVERRIDE_RESET:      { label: "Override Reset",    color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-400/20" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function absTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/** Show a compact diff of old→new values */
function DiffSummary({ oldV, newV }: { oldV: Record<string, unknown> | null; newV: Record<string, unknown> | null }) {
  if (!oldV && !newV) return null;
  if (!oldV) {
    const keys = Object.keys(newV ?? {}).slice(0, 4);
    return (
      <div className="mt-2 space-y-0.5">
        {keys.map((k) => (
          <p key={k} className="text-xs text-muted-foreground font-mono">
            <span className="text-green-400">+</span> {k}: {JSON.stringify((newV as Record<string, unknown>)[k])}
          </p>
        ))}
      </div>
    );
  }
  if (!newV) return null;

  const changed = Object.keys(newV).filter(
    (k) => JSON.stringify(newV[k]) !== JSON.stringify(oldV[k])
  ).slice(0, 5);

  if (!changed.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {changed.map((k) => (
        <div key={k} className="text-xs font-mono flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground">{k}:</span>
          <span className="text-red-400/80 line-through">{JSON.stringify(oldV[k])}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-green-400">{JSON.stringify(newV[k])}</span>
        </div>
      ))}
    </div>
  );
}

// ── Audit Log Sheet ───────────────────────────────────────────────────────────
interface AuditLogSheetProps {
  open: boolean;
  onClose: () => void;
  authH: Record<string, string>;
  filterEntityId?: string | null;
  filterEntityName?: string;
}

function AuditLogSheet({ open, onClose, authH, filterEntityId, filterEntityName }: AuditLogSheetProps) {
  const [actionFilter, setActionFilter] = useState("__all__");
  const [offset, setOffset] = useState(0);
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([]);
  const [knownTotal, setKnownTotal] = useState(0);
  const PAGE = 30;

  // Reset everything when the sheet opens/closes or the entity filter changes
  useEffect(() => {
    if (open) {
      setOffset(0);
      setAllEntries([]);
      setKnownTotal(0);
      setActionFilter("__all__");
    }
  }, [open, filterEntityId]);

  const { data: actionsData } = useQuery<{ data: string[] }>({
    queryKey: ["audit-actions"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/audit-log/actions`, { headers: authH });
      return r.json() as Promise<{ data: string[] }>;
    },
    enabled: open,
  });
  const availableActions = actionsData?.data ?? [];

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (filterEntityId) params.set("entity_id", filterEntityId);
  if (actionFilter !== "__all__") params.set("action", actionFilter);

  const { data, isFetching } = useQuery<{ data: AuditEntry[]; pagination: { total: number } }>({
    queryKey: ["audit-log", filterEntityId, actionFilter, offset],
    queryFn: async () => {
      const r = await fetch(`${BASE}/audit-log?${params.toString()}`, { headers: authH });
      return r.json() as Promise<{ data: AuditEntry[]; pagination: { total: number } }>;
    },
    enabled: open,
  });

  // Accumulate entries for "load more" — also update knownTotal from fresh data
  useEffect(() => {
    if (!data?.data) return;
    if (offset === 0) setAllEntries(data.data);
    else setAllEntries((prev) => [...prev, ...data.data]);
    setKnownTotal(data.pagination.total);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = knownTotal;
  const hasMore = allEntries.length < total;

  function resetFilters() {
    setActionFilter("__all__");
    setOffset(0);
    setAllEntries([]);
    setKnownTotal(0);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[620px] bg-[#0a0a0f] border-l border-white/8 flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ScrollText className="w-5 h-5 text-primary" />
              <div>
                <SheetTitle className="text-base font-semibold">
                  Audit Log
                  {filterEntityName && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — {filterEntityName}
                    </span>
                  )}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} {total === 1 ? "entry" : "entries"} • Admin only
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setOffset(0); setAllEntries([]); }}>
              <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10 w-52">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0c10] border-white/10 text-xs">
                <SelectItem value="__all__">All actions</SelectItem>
                {availableActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_META[a]?.label ?? a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionFilter !== "__all__" && (
              <button onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              Showing {allEntries.length} of {total}
            </span>
          </div>
        </SheetHeader>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isFetching && allEntries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
          ) : allEntries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No audit log entries found.
            </div>
          ) : (
            <>
              {allEntries.map((entry, i) => {
                const meta = ACTION_META[entry.action] ?? {
                  label: entry.action, color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20",
                };
                const entityLabel = typeof entry.entityName === "object"
                  ? (entry.entityName as Record<string, string>)?.en ?? "—"
                  : "—";

                return (
                  <div key={entry.id} className="relative">
                    {/* Timeline line */}
                    {i < allEntries.length - 1 && (
                      <div className="absolute left-[18px] top-10 bottom-0 w-px bg-white/5" />
                    )}
                    <div className="flex gap-3">
                      {/* Dot */}
                      <div className={cn(
                        "w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 z-10",
                        meta.bg
                      )}>
                        <span className={cn("text-[10px] font-bold leading-none", meta.color)}>
                          {meta.label.slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full border",
                              meta.bg, meta.color
                            )}>
                              {meta.label}
                            </span>
                            {entityLabel !== "—" && (
                              <span className="text-sm font-medium">{entityLabel}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0"
                            title={absTime(entry.createdAt)}>
                            <Clock className="w-3 h-3" />
                            {relativeTime(entry.createdAt)}
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            {entry.changedByName}
                            {entry.changedByRole && (
                              <span className="opacity-60">· {entry.changedByRole.replace("_", " ")}</span>
                            )}
                          </span>
                          {entry.branchName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {entry.branchName}
                            </span>
                          )}
                          {entry.ipAddress && (
                            <span className="text-xs text-muted-foreground/50 font-mono">
                              {entry.ipAddress}
                            </span>
                          )}
                        </div>

                        {/* Diff */}
                        <DiffSummary
                          oldV={entry.oldValue as Record<string, unknown> | null}
                          newV={entry.newValue as Record<string, unknown> | null}
                        />

                        {/* Absolute timestamp */}
                        <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-mono">
                          {absTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {hasMore && (
                <div className="text-center pt-2 pb-4">
                  <Button variant="outline" size="sm" className="gap-2"
                    onClick={() => setOffset(allEntries.length)}
                    disabled={isFetching}>
                    {isFetching ? "Loading…" : `Load more (${total - allEntries.length} remaining)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Branch Overrides View ─────────────────────────────────────────────────────
interface BranchOverridesViewProps {
  authH: Record<string, string>;
  isAdmin: boolean;
  userBranchId: string | null;
  userRole: string;
}

function BranchOverridesView({ authH, isAdmin, userBranchId, userRole }: BranchOverridesViewProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isBranchManager = userRole === "branch_manager";

  // Branch manager is locked to their own branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isBranchManager && userBranchId ? userBranchId : "__none__"
  );

  // Fetch branches (admin sees all; branch_manager locked to own)
  const { data: branchesData } = useQuery<{ data?: Branch[] }>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: authH });
      return r.json() as Promise<{ data?: Branch[] }>;
    },
    enabled: isAdmin,
  });
  const branches: Branch[] = (branchesData?.data ?? (branchesData as unknown as Branch[]) ?? []);

  // Fetch category overrides for selected branch
  const { data: overrideData, isLoading } = useQuery<{ data: BranchCatOverride[] }>({
    queryKey: ["branch-cat-overrides", selectedBranchId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/branch-overrides?branch_id=${selectedBranchId}`, { headers: authH });
      return r.json() as Promise<{ data: BranchCatOverride[] }>;
    },
    enabled: selectedBranchId !== "__none__",
  });
  const rows = overrideData?.data ?? [];

  const selectedBranchName = isBranchManager
    ? "Your Branch"
    : branches.find((b) => b.id === selectedBranchId)?.name ?? "";

  // Toggle visibility
  const { mutate: toggleVisibility } = useMutation({
    mutationFn: async (row: BranchCatOverride) => {
      const r = await fetch(`${BASE}/branch-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          productGroupId: row.id,
          branchId: selectedBranchId,
          isVisible: !row.effectiveVisible,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["branch-cat-overrides", selectedBranchId] }),
    onError: () => toast({ title: "Failed to update visibility", variant: "destructive" }),
  });

  // Reset override to global default
  const { mutate: resetOverride } = useMutation({
    mutationFn: async (row: BranchCatOverride) => {
      const r = await fetch(`${BASE}/branch-override`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ productGroupId: row.id, branchId: selectedBranchId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Override reset to global default" });
      void qc.invalidateQueries({ queryKey: ["branch-cat-overrides", selectedBranchId] });
    },
    onError: () => toast({ title: "Failed to reset override", variant: "destructive" }),
  });

  const overrideCount = rows.filter((r) => r.hasOverride).length;
  const hiddenCount   = rows.filter((r) => !r.effectiveVisible).length;

  return (
    <div className="space-y-5">
      {/* Branch selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2.5 flex-1">
            <GitBranch className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Select Branch</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                View and manage category visibility for a specific branch
              </p>
            </div>
          </div>
          {isBranchManager ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Your Branch Only</span>
            </div>
          ) : (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-64 bg-black/30 border-white/10">
                <SelectValue placeholder="Choose a branch…" />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0c10] border-white/10">
                <SelectItem value="__none__">— Choose a branch —</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {/* Stats strip */}
      {selectedBranchId !== "__none__" && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Categories", value: rows.length, color: "text-foreground" },
            { label: "With Override", value: overrideCount, color: "text-amber-400" },
            { label: "Hidden", value: hiddenCount, color: "text-red-400" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Category override table */}
      {selectedBranchId === "__none__" ? (
        <Card className="p-12 text-center text-muted-foreground">
          Select a branch above to manage its category overrides
        </Card>
      ) : isLoading ? (
        <Card className="p-12 text-center text-muted-foreground text-sm">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm">No categories found.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{selectedBranchName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggles apply only to this branch. Global defaults shown in grey.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-amber-400/70 inline-block" /> = has override
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/3 text-left text-xs text-muted-foreground border-b border-white/5">
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-center">Types</th>
                  <th className="px-4 py-3 font-medium text-center">Items</th>
                  <th className="px-4 py-3 font-medium text-center">Global</th>
                  <th className="px-4 py-3 font-medium text-center">This Branch</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className={cn(
                    "text-sm transition-colors hover:bg-white/3",
                    !row.effectiveVisible && "opacity-60"
                  )}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{row.icon}</span>
                        <div>
                          <p className="font-medium">{row.name?.en ?? "—"}</p>
                          {row.name?.zh && (
                            <p className="text-xs text-muted-foreground">{row.name.zh}</p>
                          )}
                        </div>
                        {row.hasOverride && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Has branch override" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.typeCount}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.itemCount}</td>
                    <td className="px-4 py-3 text-center">
                      {row.globalIsActive ? (
                        <span className="text-green-400 text-xs">Visible</span>
                      ) : (
                        <span className="text-gray-500 text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          role="switch"
                          aria-checked={row.effectiveVisible}
                          aria-label={`Toggle ${row.name?.en ?? ""} for ${selectedBranchName}`}
                          onClick={() => toggleVisibility(row)}
                          className="flex items-center gap-1.5 text-xs transition-colors"
                          disabled={!isAdmin && !isBranchManager}
                        >
                          {row.effectiveVisible ? (
                            <><ToggleRight className="w-6 h-6 text-green-400" />
                              <span className="text-green-400 font-medium">On</span></>
                          ) : (
                            <><ToggleLeft className="w-6 h-6 text-gray-500" />
                              <span className="text-muted-foreground">Off</span></>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.hasOverride && (isAdmin || isBranchManager) && (
                        <button
                          onClick={() => resetOverride(row)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto transition-colors"
                          title="Reset to global default"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="px-5 py-3 border-t border-white/5 bg-white/2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ToggleRight className="w-4 h-4 text-green-400" /> Visible for this branch
            </span>
            <span className="flex items-center gap-1.5">
              <ToggleLeft className="w-4 h-4 text-gray-500" /> Hidden for this branch
            </span>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" /> Reset removes override — reverts to global setting
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Amber dot = override active
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsMenuConfig() {
  const { token, user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const authH = { Authorization: `Bearer ${token}` };
  const isAdmin       = ["super_admin", "admin"].includes(user?.role ?? "");
  const canOverride   = ["super_admin", "admin", "branch_manager"].includes(user?.role ?? "");
  const userBranchId  = user?.branchId ?? null;
  const userRole      = user?.role ?? "";

  // Top-level view mode
  const [viewMode, setViewMode] = useState<"categories" | "branch-overrides" | "category-setting">("categories");

  // Audit log sheet
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string | null>(null);
  const [auditEntityName, setAuditEntityName] = useState<string | undefined>(undefined);

  function openAudit(entityId?: string, entityName?: string) {
    setAuditEntityId(entityId ?? null);
    setAuditEntityName(entityName);
    setAuditOpen(true);
  }

  // Category view state
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"types" | "settings" | "branches">("types");
  const [catModal, setCatModal] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [typeModal, setTypeModal] = useState<{ open: boolean; editing: SubType | null }>({ open: false, editing: null });

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: catsData, isLoading: catsLoading } = useQuery<{ data: Category[] }>({
    queryKey: ["menu-config-cats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/categories`, { headers: authH });
      return r.json() as Promise<{ data: Category[] }>;
    },
  });
  const categories = catsData?.data ?? [];
  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) setSelectedCatId(categories[0].id);
  }, [categories, selectedCatId]);

  const { data: typesData, isLoading: typesLoading } = useQuery<{ data: SubType[] }>({
    queryKey: ["menu-config-types", selectedCatId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/categories/${selectedCatId}/types`, { headers: authH });
      return r.json() as Promise<{ data: SubType[] }>;
    },
    enabled: !!selectedCatId,
  });
  const types = typesData?.data ?? [];

  const { data: overridesData } = useQuery<{ data: BranchOverride[] }>({
    queryKey: ["menu-config-overrides", selectedCatId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/categories/${selectedCatId}/branch-overrides`, { headers: authH });
      return r.json() as Promise<{ data: BranchOverride[] }>;
    },
    enabled: !!selectedCatId && activeTab === "branches",
  });
  const overrides = overridesData?.data ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: sortCat } = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      await fetch(`${BASE}/categories/${id}/sort`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ sortOrder }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menu-config-cats"] }),
  });

  const { mutate: toggleCat } = useMutation({
    mutationFn: async (cat: Category) => {
      await fetch(`${BASE}/categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menu-config-cats"] }),
  });

  const { mutate: toggleType } = useMutation({
    mutationFn: async (t: SubType) => {
      await fetch(`${BASE}/types/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
    },
    onSuccess: (_d, t) => {
      toast({ title: t.isActive ? "Sub-type deactivated" : "Sub-type activated" });
      void qc.invalidateQueries({ queryKey: ["menu-config-types", selectedCatId] });
    },
    onError: () => toast({ title: "Failed to update sub-type", variant: "destructive" }),
  });

  const { mutate: toggleOverride } = useMutation({
    mutationFn: async (o: BranchOverride) => {
      await fetch(`${BASE}/branch-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ productGroupId: selectedCatId, branchId: o.branchId, isVisible: !o.isVisible }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menu-config-overrides", selectedCatId] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  // ── Category Setting assignment state ───────────────────────────────────────
  const [assignMenuCatId, setAssignMenuCatId] = useState<string>("__none__");
  const [assignSaving, setAssignSaving]       = useState(false);

  useEffect(() => {
    setAssignMenuCatId(selectedCat?.menuCategoryId ?? "__none__");
  }, [selectedCat?.id, selectedCat?.menuCategoryId]);

  const { data: menuCatsData } = useQuery<{ data: MenuCat[] }>({
    queryKey: ["menu-cats-setting"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/menu-categories`, { headers: authH });
      return r.json() as Promise<{ data: MenuCat[] }>;
    },
  });
  const menuCatOptions = (menuCatsData?.data ?? []).filter((m) => m.isActive);

  const assignDirty = assignMenuCatId !== (selectedCat?.menuCategoryId ?? "__none__");

  async function saveAssign() {
    if (!selectedCat) return;
    setAssignSaving(true);
    try {
      const r = await fetch(`${BASE}/categories/${selectedCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ menuCategoryId: assignMenuCatId === "__none__" ? null : assignMenuCatId }),
      });
      if (!r.ok) throw new Error("Failed");
      toast({ title: "Category Setting assigned" });
      void qc.invalidateQueries({ queryKey: ["menu-config-cats"] });
    } catch {
      toast({ title: "Failed to assign Category Setting", variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  }

  // ── Sort helpers ────────────────────────────────────────────────────────────
  function moveCategory(idx: number, dir: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = sorted[idx + dir];
    const current = sorted[idx];
    if (!target) return;
    sortCat({ id: current.id, sortOrder: target.sortOrder });
    sortCat({ id: target.id, sortOrder: current.sortOrder });
  }

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Menu Configuration</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage categories, sub-types, tax overrides and branch visibility
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" className="gap-2 text-xs h-8" onClick={() => openAudit()}>
                <ScrollText className="w-3.5 h-3.5" /> Audit Log
              </Button>
            )}
            {isAdmin && viewMode === "categories" && (
              <Button className="gap-2" onClick={() => setCatModal({ open: true, editing: null })}>
                <Plus className="w-4 h-4" /> New Category
              </Button>
            )}
          </div>
        </div>

        {/* ── Top-level View Tabs ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-white/8 pb-0">
          {([
            { key: "categories",       label: "Categories",       icon: Layers    },
            { key: "branch-overrides", label: "Branch Overrides", icon: GitBranch },
            { key: "category-setting", label: "Category Setting", icon: Shield    },
          ] as const).map(({ key, label, icon: Icon }) => (
            (key === "branch-overrides" && !canOverride) ? null :
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
                viewMode === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── CATEGORY SETTING VIEW ────────────────────────────────────────── */}
        {viewMode === "category-setting" && (
          <CategorySettingView authH={authH} isAdmin={isAdmin} />
        )}

        {/* ── BRANCH OVERRIDES VIEW ─────────────────────────────────────────── */}
        {viewMode === "branch-overrides" && (
          <BranchOverridesView
            authH={authH}
            isAdmin={isAdmin}
            userBranchId={userBranchId}
            userRole={userRole}
          />
        )}

        {/* ── CATEGORIES VIEW ───────────────────────────────────────────────── */}
        {viewMode === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Left: category list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
                Categories ({categories.length})
              </p>

              {catsLoading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
              ) : sortedCats.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground text-sm">No categories yet.</Card>
              ) : (
                <div className="space-y-1.5">
                  {sortedCats.map((cat, idx) => (
                    <motion.div key={cat.id} layout>
                      <button
                        onClick={() => { setSelectedCatId(cat.id); setActiveTab("types"); }}
                        className={cn(
                          "w-full text-left rounded-xl border transition-all duration-150 p-3",
                          selectedCatId === cat.id
                            ? "bg-primary/10 border-primary/30 text-foreground"
                            : "bg-card/40 border-white/5 text-muted-foreground hover:border-white/15 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {isAdmin && (
                            <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                              <button onClick={(e) => { e.stopPropagation(); moveCategory(idx, -1); }}
                                disabled={idx === 0}
                                className="p-0.5 hover:text-primary disabled:opacity-20 transition-colors">
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); moveCategory(idx, 1); }}
                                disabled={idx === sortedCats.length - 1}
                                className="p-0.5 hover:text-primary disabled:opacity-20 transition-colors">
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <span className="text-xl leading-none flex-shrink-0 mt-0.5">{cat.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{cat.name?.en ?? "—"}</span>
                              {!cat.isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 flex-shrink-0">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {cat.name?.zh && <span className="text-xs text-muted-foreground">{cat.name.zh}</span>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{cat.typeCount} types</span>
                              <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{cat.itemCount} items</span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); toggleCat(cat); }}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                title={cat.isActive ? "Deactivate" : "Activate"}>
                                {cat.isActive
                                  ? <Eye className="w-3.5 h-3.5 text-green-400" />
                                  : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, editing: cat }); }}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: category detail */}
            <div>
              {!selectedCat ? (
                <Card className="p-12 text-center text-muted-foreground">
                  Select a category to manage its sub-types and settings
                </Card>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-card/50 border border-white/5 rounded-xl p-1">
                      {(["types", "settings", "branches"] as const).map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === tab
                              ? "bg-primary text-primary-foreground shadow"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                          )}>
                          {tab === "types" ? "Sub-types" : tab === "settings" ? "Settings" : "Branch Visibility"}
                        </button>
                      ))}
                    </div>
                    {isAdmin && selectedCat && (
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
                        data-testid="category-audit-log-btn"
                        onClick={() => openAudit(
                          selectedCat.id,
                          typeof selectedCat.name === "object"
                            ? (selectedCat.name as Record<string, string>).en ?? "Category"
                            : String(selectedCat.name)
                        )}
                      >
                        <ScrollText className="w-3.5 h-3.5" /> Audit Log
                      </Button>
                    )}
                  </div>

                  {/* Sub-types tab */}
                  {activeTab === "types" && (
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">{selectedCat.icon} {selectedCat.name?.en}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{types.length} sub-types</p>
                        </div>
                        {isAdmin && (
                          <Button size="sm" className="gap-1.5"
                            onClick={() => setTypeModal({ open: true, editing: null })}>
                            <Plus className="w-3.5 h-3.5" /> Add Sub-type
                          </Button>
                        )}
                      </div>
                      {typesLoading ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
                      ) : types.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          No sub-types yet. Add one to start classifying menu items.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10 text-left text-xs text-muted-foreground">
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Items</th>
                                <th className="px-4 py-3 font-medium">Order</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {[...types].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => (
                                <tr key={t.id} className="border-b border-white/5 last:border-0 text-sm hover:bg-white/3">
                                  <td className="px-4 py-3">
                                    <p className="font-medium">{t.name?.en}</p>
                                    {t.name?.zh && <p className="text-xs text-muted-foreground">{t.name.zh}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">{t.itemCount}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{t.sortOrder}</td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={t.isActive ? "active" : "inactive"}
                                      label={t.isActive ? "Active" : "Inactive"} />
                                  </td>
                                  {isAdmin && (
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1 justify-end">
                                        <Button variant="ghost" size="icon" className="h-7 w-7"
                                          title={t.isActive ? "Deactivate" : "Activate"}
                                          onClick={() => toggleType(t)}>
                                          {t.isActive
                                            ? <Eye className="w-3.5 h-3.5 text-green-400" />
                                            : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7"
                                          onClick={() => setTypeModal({ open: true, editing: t })}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Settings tab */}
                  {activeTab === "settings" && (
                    <Card className="p-5 space-y-5">
                      {/* Basic settings grid */}
                      <div>
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-primary" /> Category Settings
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <SettingItem label="Tax Override" value={
                            selectedCat.taxRateOverride != null
                              ? `${(selectedCat.taxRateOverride * 100).toFixed(1)}%`
                              : "Inherit branch default"
                          } />
                          <SettingItem label="Commission Rate" value={
                            selectedCat.commissionDefaultRate
                              ? `${(selectedCat.commissionDefaultRate * 100).toFixed(1)}%`
                              : "—"
                          } />
                          <SettingItem label="Commission Flat" value={
                            selectedCat.commissionDefaultFlat
                              ? `MYR ${selectedCat.commissionDefaultFlat.toFixed(2)}`
                              : "—"
                          } />
                          <SettingItem label="Icon" value={selectedCat.icon} />
                          <SettingItem label="Sort Order" value={String(selectedCat.sortOrder)} />
                          <SettingItem label="Status" value={selectedCat.isActive ? "Active" : "Inactive"} />
                        </div>
                        {selectedCat.notes && (
                          <div className="mt-4 p-3 bg-black/30 rounded-xl border border-white/5">
                            <p className="text-xs text-muted-foreground mb-1">Notes</p>
                            <p className="text-sm">{selectedCat.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Category Setting assignment */}
                      <div className="pt-4 border-t border-white/5">
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-primary" /> Menu Visibility Setting
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Assign a Category Setting to control which staff roles can see this category in the menu.
                        </p>

                        {/* Read-only display for non-admins */}
                        {!isAdmin && (
                          <div className="flex items-center gap-2">
                            {selectedCat.menuCatName ? (
                              <>
                                <span className="text-sm font-medium">{selectedCat.menuCatName}</span>
                                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                                  selectedCat.menuCatVisibilityLevel === "ADMIN_ONLY" ? "bg-red-400/10 border-red-400/20 text-red-400"
                                  : selectedCat.menuCatVisibilityLevel === "MANAGER_ONLY" ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                                  : "bg-green-400/10 border-green-400/20 text-green-400"
                                )}>
                                  {selectedCat.menuCatVisibilityLevel === "ADMIN_ONLY" ? "Admin Only"
                                    : selectedCat.menuCatVisibilityLevel === "MANAGER_ONLY" ? "Manager+"
                                    : "All Staff"}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">No setting assigned — visible to all staff</span>
                            )}
                          </div>
                        )}

                        {/* Admin: dropdown selector */}
                        {isAdmin && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <Select value={assignMenuCatId} onValueChange={setAssignMenuCatId}>
                              <SelectTrigger className="w-56 h-8 text-xs bg-black/30 border-white/10">
                                <SelectValue placeholder="Select category setting…" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0c0c10] border-white/10">
                                <SelectItem value="__none__">
                                  <span className="text-muted-foreground">— None (visible to all) —</span>
                                </SelectItem>
                                {menuCatOptions.map((mc) => (
                                  <SelectItem key={mc.id} value={mc.id}>
                                    <span>{mc.name}</span>
                                    <span className={cn("ml-2 text-xs",
                                      mc.visibilityLevel === "ADMIN_ONLY" ? "text-red-400"
                                      : mc.visibilityLevel === "MANAGER_ONLY" ? "text-yellow-400"
                                      : "text-green-400"
                                    )}>
                                      {mc.visibilityLevel === "ADMIN_ONLY" ? "(Admin Only)"
                                        : mc.visibilityLevel === "MANAGER_ONLY" ? "(Manager+)"
                                        : "(All Staff)"}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assignDirty && (
                              <Button size="sm" className="h-8 text-xs px-3" disabled={assignSaving} onClick={() => void saveAssign()}>
                                {assignSaving ? "Saving…" : "Save"}
                              </Button>
                            )}
                            {!assignDirty && selectedCat.menuCatName && (
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                                  selectedCat.menuCatVisibilityLevel === "ADMIN_ONLY" ? "bg-red-400/10 border-red-400/20 text-red-400"
                                  : selectedCat.menuCatVisibilityLevel === "MANAGER_ONLY" ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                                  : "bg-green-400/10 border-green-400/20 text-green-400"
                                )}>
                                  {selectedCat.menuCatVisibilityLevel === "ADMIN_ONLY" ? "Admin Only"
                                    : selectedCat.menuCatVisibilityLevel === "MANAGER_ONLY" ? "Manager+"
                                    : "All Staff"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {isAdmin && (
                        <div className="pt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
                          <Button variant="outline" size="sm" className="gap-1.5"
                            onClick={() => setCatModal({ open: true, editing: selectedCat })}>
                            <Pencil className="w-3.5 h-3.5" /> Edit Category
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => openAudit(
                              selectedCat.id,
                              typeof selectedCat.name === "object"
                                ? (selectedCat.name as Record<string,string>).en ?? "Category"
                                : String(selectedCat.name)
                            )}>
                            <ScrollText className="w-3.5 h-3.5" /> View Audit Log
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Branch Visibility tab (per-category view) */}
                  {activeTab === "branches" && (
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" /> Branch Visibility
                        </h3>
                        <button
                          onClick={() => setViewMode("branch-overrides")}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <GitBranch className="w-3 h-3" /> Branch-first view
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Control which branches show this category in their menus.
                      </p>
                      {overrides.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">No branches configured.</div>
                      ) : (
                        <div className="space-y-2">
                          {overrides.map((o) => (
                            <div key={o.branchId}
                              className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/20 border border-white/5">
                              <div>
                                <p className="text-sm font-medium">{o.branchName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {o.isVisible ? "Visible in menu" : "Hidden from menu"}
                                </p>
                              </div>
                              {isAdmin ? (
                                <button
                                  role="switch"
                                  aria-checked={o.isVisible}
                                  aria-label={`Toggle visibility for ${o.branchName}`}
                                  onClick={() => toggleOverride(o)}
                                  className="flex items-center gap-1.5 text-sm transition-colors">
                                  {o.isVisible
                                    ? <><ToggleRight className="w-6 h-6 text-green-400" /><span className="text-green-400">On</span></>
                                    : <><ToggleLeft className="w-6 h-6 text-gray-500" /><span className="text-muted-foreground">Off</span></>
                                  }
                                </button>
                              ) : (
                                <span className={o.isVisible ? "text-green-400 text-sm" : "text-muted-foreground text-sm"}>
                                  {o.isVisible ? "Visible" : "Hidden"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <CategoryModal
        open={catModal.open}
        onClose={() => setCatModal({ open: false, editing: null })}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["menu-config-cats"] })}
        authH={authH}
        editing={catModal.editing}
      />
      <TypeModal
        open={typeModal.open}
        onClose={() => setTypeModal({ open: false, editing: null })}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["menu-config-types", selectedCatId] })}
        authH={authH}
        categoryId={selectedCatId ?? ""}
        editing={typeModal.editing}
      />
      {/* ── Audit Log Sheet ─────────────────────────────────────────────────── */}
      {isAdmin && (
        <AuditLogSheet
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          authH={authH}
          filterEntityId={auditEntityId}
          filterEntityName={auditEntityName}
        />
      )}
    </>
  );
}

// ── Category Setting View ─────────────────────────────────────────────────────
const VIS_OPTIONS = [
  { value: "ALL",           label: "All Staff",    color: "text-green-400",  dot: "bg-green-400" },
  { value: "MANAGER_ONLY",  label: "Manager +",    color: "text-amber-400",  dot: "bg-amber-400" },
  { value: "ADMIN_ONLY",    label: "Admin Only",   color: "text-red-400",    dot: "bg-red-400"   },
] as const;

const DISP_OPTIONS = [
  { value: "REAL_NAME",     label: "Real Name" },
  { value: "MASKED_CODE",   label: "Masked Code (SVC-XXX)" },
  { value: "MASKED_SYMBOL", label: "Masked Symbol (XXXX)" },
  { value: "CUSTOM_ALIAS",  label: "Custom Alias" },
] as const;

interface MenuCatCreateModalProps {
  open: boolean; onClose: () => void; onSaved: () => void; authH: Record<string, string>;
}
function MenuCatCreateModal({ open, onClose, onSaved, authH }: MenuCatCreateModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [vis,  setVis]  = useState("ALL");
  const [disp, setDisp] = useState("REAL_NAME");
  const [alias, setAlias] = useState("");

  useEffect(() => { if (open) { setName(""); setDesc(""); setVis("ALL"); setDisp("REAL_NAME"); setAlias(""); } }, [open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/menu-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, visibilityLevel: vis, invoiceDisplayMode: disp, invoiceAlias: disp === "CUSTOM_ALIAS" ? alias.trim() : null }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})) as Record<string, string>; throw new Error(e.message ?? "Failed"); }
    },
    onSuccess: () => { toast({ title: "Category created" }); onSaved(); onClose(); },
    onError:   (e: Error) => toast({ title: e.message ?? "Failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-[#0c0c10] border border-white/10">
        <DialogHeader><DialogTitle>New Menu Category</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Services" className="bg-black/30 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" className="bg-black/30 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label>Who can see this category?</Label>
            <Select value={vis} onValueChange={setVis}>
              <SelectTrigger className="bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0c0c10] border-white/10">
                {VIS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Display Mode</Label>
            <Select value={disp} onValueChange={setDisp}>
              <SelectTrigger className="bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0c0c10] border-white/10">
                {DISP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {disp === "CUSTOM_ALIAS" && (
            <div className="space-y-1.5">
              <Label>Custom Alias</Label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. SVC-PREMIUM" className="bg-black/30 border-white/10" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategorySettingView({ authH, isAdmin }: { authH: Record<string, string>; isAdmin: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, MenuCatEdits>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [newModal, setNewModal] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery<{ data: MenuCat[] }>({
    queryKey: ["menu-cats-setting"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/menu-categories`, { headers: authH });
      return r.json() as Promise<{ data: MenuCat[] }>;
    },
  });
  const cats = data?.data ?? [];

  function getField<K extends keyof MenuCatEdits>(cat: MenuCat, key: K): string {
    const e = edits[cat.id];
    if (e && key in e) return e[key] as string;
    if (key === "name")               return cat.name;
    if (key === "visibilityLevel")    return cat.visibilityLevel;
    if (key === "invoiceDisplayMode") return cat.invoiceDisplayMode;
    if (key === "invoiceAlias")       return cat.invoiceAlias ?? "";
    return "";
  }

  function setField(catId: string, key: keyof MenuCatEdits, val: string) {
    setEdits((prev) => ({ ...prev, [catId]: { ...prev[catId], [key]: val } }));
  }

  function isDirty(catId: string) { return !!edits[catId] && Object.keys(edits[catId]).length > 0; }

  async function save(cat: MenuCat) {
    const e = edits[cat.id];
    if (!e) return;
    setSaving((p) => ({ ...p, [cat.id]: true }));
    try {
      const r = await fetch(`${BASE}/menu-categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(e),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})) as Record<string, string>; throw new Error(err.message ?? "Failed"); }
      toast({ title: "Saved" });
      setEdits((p) => { const n = { ...p }; delete n[cat.id]; return n; });
      void qc.invalidateQueries({ queryKey: ["menu-cats-setting"] });
    } catch (err: unknown) {
      toast({ title: (err as Error).message ?? "Save failed", variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [cat.id]: false }));
    }
  }

  async function toggleMenuCat(cat: MenuCat) {
    setToggling((p) => ({ ...p, [cat.id]: true }));
    try {
      const r = await fetch(`${BASE}/menu-categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})) as Record<string, string>; throw new Error(e.message ?? "Failed"); }
      toast({ title: cat.isActive ? "Category deactivated" : "Category activated" });
      void qc.invalidateQueries({ queryKey: ["menu-cats-setting"] });
    } catch (err: unknown) {
      toast({ title: (err as Error).message ?? "Failed", variant: "destructive" });
    } finally {
      setToggling((p) => ({ ...p, [cat.id]: false }));
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Menu Category Access Control</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set who can see each category in the Operations → Menu page and how items appear on invoices.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2" onClick={() => setNewModal(true)}>
            <Plus className="w-4 h-4" /> New Category
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {VIS_OPTIONS.map((o) => (
          <div key={o.value} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${o.dot}`} />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
      ) : cats.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
          No menu categories yet. Create one to get started.
        </Card>
      ) : (
        <div className="space-y-2">
          {cats.map((cat) => {
            const dirty   = isDirty(cat.id);
            const isSaving = saving[cat.id] ?? false;
            const visVal  = getField(cat, "visibilityLevel");
            const dispVal = getField(cat, "invoiceDisplayMode");
            const visMeta = VIS_OPTIONS.find((o) => o.value === visVal) ?? VIS_OPTIONS[0];

            return (
              <Card key={cat.id} className={cn(
                "p-4 border transition-all duration-150",
                dirty ? "border-primary/40 bg-primary/5" : "border-white/8 bg-card/40",
                !cat.isActive && "opacity-50"
              )}>
                <div className="flex items-start gap-4 flex-wrap lg:flex-nowrap">
                  {/* Status dot + name */}
                  <div className="flex items-center gap-2 min-w-[180px]">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${visMeta.dot}`} />
                    <div className="min-w-0">
                      {isAdmin ? (
                        <Input
                          value={getField(cat, "name")}
                          onChange={(e) => setField(cat.id, "name", e.target.value)}
                          className="h-7 text-sm bg-transparent border-transparent hover:border-white/20 focus:border-white/30 px-1 py-0"
                        />
                      ) : (
                        <span className="text-sm font-medium">{cat.name}</span>
                      )}
                      <p className="text-[11px] text-muted-foreground ml-1">
                        {cat.itemCount} item{cat.itemCount !== 1 ? "s" : ""}
                        {!cat.isActive && " · Inactive"}
                      </p>
                    </div>
                  </div>

                  {/* Visibility */}
                  <div className="flex-1 min-w-[150px] space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Who can see</p>
                    {isAdmin ? (
                      <Select value={visVal} onValueChange={(v) => setField(cat.id, "visibilityLevel", v)}>
                        <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0c0c10] border-white/10">
                          {VIS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <span className={cn("flex items-center gap-2", o.color)}>
                                <span className={`w-1.5 h-1.5 rounded-full ${o.dot}`} />
                                {o.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={cn("text-xs font-medium", visMeta.color)}>{visMeta.label}</span>
                    )}
                  </div>

                  {/* Invoice display mode */}
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Invoice display</p>
                    {isAdmin ? (
                      <Select value={dispVal} onValueChange={(v) => setField(cat.id, "invoiceDisplayMode", v)}>
                        <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0c0c10] border-white/10">
                          {DISP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">{DISP_OPTIONS.find((o) => o.value === dispVal)?.label ?? dispVal}</span>
                    )}
                  </div>

                  {/* Custom alias (conditional) */}
                  {dispVal === "CUSTOM_ALIAS" && (
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Alias</p>
                      {isAdmin ? (
                        <Input
                          value={getField(cat, "invoiceAlias")}
                          onChange={(e) => setField(cat.id, "invoiceAlias", e.target.value)}
                          placeholder="e.g. SVC-001"
                          className="h-8 text-xs bg-black/30 border-white/10"
                        />
                      ) : (
                        <span className="text-xs font-mono">{cat.invoiceAlias ?? "—"}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0 self-center">
                      {dirty && (
                        <Button size="sm" className="h-7 text-xs px-3" disabled={isSaving} onClick={() => save(cat)}>
                          {isSaving ? "Saving…" : "Save"}
                        </Button>
                      )}
                      <button
                        onClick={() => toggleMenuCat(cat)}
                        disabled={toggling[cat.id]}
                        className="p-1.5 rounded hover:bg-white/5 transition-colors"
                        title={cat.isActive ? "Deactivate" : "Activate"}
                      >
                        {cat.isActive
                          ? <Eye className="w-3.5 h-3.5 text-green-400" />
                          : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <MenuCatCreateModal
        open={newModal}
        onClose={() => setNewModal(false)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["menu-cats-setting"] })}
        authH={authH}
      />

    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
function SettingItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
