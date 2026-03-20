import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Tag,
  ToggleLeft, ToggleRight, Eye, EyeOff, Settings2, Layers, BookOpen,
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
      setTaxRate(editing.taxRateOverride != null ? String(Math.round(editing.taxRateOverride * 100)) : "");
      setCommRate(editing.commissionDefaultRate ? String(Math.round(editing.commissionDefaultRate * 100)) : "");
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
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: editing ? "Category updated" : "Category created" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to save category", variant: "destructive" }),
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
                value={commRate} onChange={(e) => setCommRate(e.target.value)}
                placeholder="e.g. 10" className="bg-black/30 border-white/10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-comm-f">Comm. Flat (MYR)</Label>
              <Input id="cat-comm-f" type="number" min="0" step="0.01"
                value={commFlat} onChange={(e) => setCommFlat(e.target.value)}
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
    } else {
      setNameEn(""); setNameZh(""); setSortOrder("0");
    }
  }, [editing, open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const body = {
        name: { en: nameEn.trim(), ...(nameZh.trim() ? { zh: nameZh.trim() } : {}) },
        sortOrder: parseInt(sortOrder) || 0,
      };
      const url = editing
        ? `${BASE}/types/${editing.id}`
        : `${BASE}/categories/${categoryId}/types`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: editing ? "Sub-type updated" : "Sub-type created" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Failed to save sub-type", variant: "destructive" }),
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsMenuConfig() {
  const { token, user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const authH = { Authorization: `Bearer ${token}` };
  const isAdmin = ["super_admin", "admin"].includes(user?.role ?? "");

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"types" | "settings" | "branches">("types");
  const [catModal, setCatModal] = useState<{ open: boolean; editing: Category | null }>({
    open: false, editing: null,
  });
  const [typeModal, setTypeModal] = useState<{ open: boolean; editing: SubType | null }>({
    open: false, editing: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cat" | "subtype"; id: string } | null>(null);

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

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
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

  const { mutate: deleteCat } = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/categories/${id}`, {
        method: "DELETE",
        headers: authH,
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      toast({ title: "Category deactivated" });
      void qc.invalidateQueries({ queryKey: ["menu-config-cats"] });
      if (selectedCatId === deleteConfirm?.id) setSelectedCatId(null);
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const { mutate: deleteType } = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/types/${id}`, { method: "DELETE", headers: authH });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      toast({ title: "Sub-type deactivated" });
      void qc.invalidateQueries({ queryKey: ["menu-config-types", selectedCatId] });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const { mutate: toggleOverride } = useMutation({
    mutationFn: async (o: BranchOverride) => {
      await fetch(`${BASE}/branch-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({
          productGroupId: selectedCatId,
          branchId: o.branchId,
          isVisible: !o.isVisible,
        }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menu-config-overrides", selectedCatId] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  // ── Sorting helpers ─────────────────────────────────────────────────────────
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
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Menu Configuration</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage categories, sub-types, tax overrides and branch visibility
            </p>
          </div>
          {isAdmin && (
            <Button className="gap-2" onClick={() => setCatModal({ open: true, editing: null })}>
              <Plus className="w-4 h-4" /> New Category
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* ── Left: category list ─────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
              Categories ({categories.length})
            </p>

            {catsLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
            ) : sortedCats.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground text-sm">
                No categories yet.
              </Card>
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
                        {/* Sort arrows */}
                        {isAdmin && (
                          <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveCategory(idx, -1); }}
                              disabled={idx === 0}
                              className="p-0.5 hover:text-primary disabled:opacity-20 transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveCategory(idx, 1); }}
                              disabled={idx === sortedCats.length - 1}
                              className="p-0.5 hover:text-primary disabled:opacity-20 transition-colors"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <span className="text-xl leading-none flex-shrink-0 mt-0.5">{cat.icon}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {cat.name?.en ?? "—"}
                            </span>
                            {!cat.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 flex-shrink-0">
                                Inactive
                              </span>
                            )}
                          </div>
                          {cat.name?.zh && (
                            <span className="text-xs text-muted-foreground">{cat.name.zh}</span>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />{cat.typeCount} types
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />{cat.itemCount} items
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCat(cat); }}
                              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                              title={cat.isActive ? "Deactivate" : "Activate"}
                            >
                              {cat.isActive
                                ? <Eye className="w-3.5 h-3.5 text-green-400" />
                                : <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                              }
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, editing: cat }); }}
                              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "cat", id: cat.id }); }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive/60 hover:text-destructive" />
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

          {/* ── Right: selected category detail ────────────────────────── */}
          <div>
            {!selectedCat ? (
              <Card className="p-12 text-center text-muted-foreground">
                Select a category to manage its sub-types and settings
              </Card>
            ) : (
              <div className="space-y-5">
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-card/50 border border-white/5 rounded-xl p-1 w-fit">
                  {(["types", "settings", "branches"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        activeTab === tab
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      {tab === "types" ? "Sub-types" : tab === "settings" ? "Settings" : "Branch Visibility"}
                    </button>
                  ))}
                </div>

                {/* ── Tab: Sub-types ─────────────────────────────────────── */}
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
                              <tr key={t.id}
                                className="border-b border-white/5 last:border-0 text-sm hover:bg-white/3">
                                <td className="px-4 py-3">
                                  <p className="font-medium">{t.name?.en}</p>
                                  {t.name?.zh && (
                                    <p className="text-xs text-muted-foreground">{t.name.zh}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{t.itemCount}</td>
                                <td className="px-4 py-3 text-muted-foreground">{t.sortOrder}</td>
                                <td className="px-4 py-3">
                                  <StatusBadge
                                    status={t.isActive ? "active" : "inactive"}
                                    label={t.isActive ? "Active" : "Inactive"}
                                  />
                                </td>
                                {isAdmin && (
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1 justify-end">
                                      <Button variant="ghost" size="icon" className="h-7 w-7"
                                        onClick={() => setTypeModal({ open: true, editing: t })}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon"
                                        className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => setDeleteConfirm({ type: "subtype", id: t.id })}>
                                        <Trash2 className="w-3.5 h-3.5" />
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

                {/* ── Tab: Settings ──────────────────────────────────────── */}
                {activeTab === "settings" && (
                  <Card className="p-5">
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
                    {isAdmin && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <Button variant="outline" size="sm" className="gap-1.5"
                          onClick={() => setCatModal({ open: true, editing: selectedCat })}>
                          <Pencil className="w-3.5 h-3.5" /> Edit Category
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

                {/* ── Tab: Branch Visibility ────────────────────────────── */}
                {activeTab === "branches" && (
                  <Card className="p-5">
                    <h3 className="font-semibold mb-1 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" /> Branch Visibility
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Control which branches show this category in their menus.
                    </p>
                    {overrides.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        No branches configured.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {overrides.map((o) => (
                          <div key={o.branchId}
                            className="flex items-center justify-between px-4 py-3 rounded-xl
                                       bg-black/20 border border-white/5">
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
                                className="flex items-center gap-1.5 text-sm transition-colors"
                              >
                                {o.isVisible
                                  ? <><ToggleRight className="w-6 h-6 text-green-400" />
                                    <span className="text-green-400">On</span></>
                                  : <><ToggleLeft className="w-6 h-6 text-gray-500" />
                                    <span className="text-muted-foreground">Off</span></>
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
      </motion.div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
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

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm bg-[#0c0c10] border border-white/10">
          <DialogHeader>
            <DialogTitle>Confirm Deactivation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will deactivate the {deleteConfirm?.type === "cat" ? "category" : "sub-type"}.
            Existing menu items will not be deleted.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "cat") deleteCat(deleteConfirm.id);
                else deleteType(deleteConfirm.id);
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
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
