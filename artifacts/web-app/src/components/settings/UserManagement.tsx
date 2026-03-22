import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Plus, Loader2, ChevronLeft, ChevronRight, UserCircle, Wallet, Eye, EyeOff,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import UserDetailPanel from "./UserDetailPanel";

const ROLE_LABELS: Record<string, string> = {
  super_admin:    "Super Admin",
  admin:          "Admin",
  branch_manager: "Branch Manager",
  manager:        "Manager",
  hostess:        "Hostess",
  driver:         "Driver",
  general:        "General Staff",
  hall:           "Hall Staff",
  kitchen:        "Kitchen Staff",
  investor:       "Investor",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin:    "bg-purple-100 text-purple-800 border-purple-200",
  admin:          "bg-blue-100 text-blue-800 border-blue-200",
  branch_manager: "bg-indigo-100 text-indigo-800 border-indigo-200",
  manager:        "bg-cyan-100 text-cyan-800 border-cyan-200",
  hostess:        "bg-pink-100 text-pink-800 border-pink-200",
  driver:         "bg-amber-100 text-amber-800 border-amber-200",
  general:        "bg-gray-100 text-gray-700 border-gray-200",
  hall:           "bg-teal-100 text-teal-800 border-teal-200",
  kitchen:        "bg-orange-100 text-orange-800 border-orange-200",
  investor:       "bg-green-100 text-green-800 border-green-200",
};

interface StaffUser {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  branch_name: string | null;
  branch_id: string | null;
  plain_password: string | null;
  ledger_balance: string | null;
  ledger_currency: string | null;
}

interface Branch {
  id: string;
  name: string;
  internal_code: string | null;
}

interface UsersResponse {
  success: boolean;
  data: StaffUser[];
  total: number;
  limit: number;
  offset: number;
}

interface BranchesResponse {
  success: boolean;
  data: Branch[];
}

const PAGE_SIZE = 20;

function fmtMYR(val: string | number | null | undefined) {
  if (val == null) return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

// ─── New User Modal ─────────────────────────────────────────────────────────
interface NewUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  branches: Branch[];
}

function NewUserModal({ open, onClose, onCreated, branches }: NewUserModalProps) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ full_name: "", email: "", role: "__none__", password: "", phone: "", branch_id: "__none__" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!form.full_name || !form.email || form.role === "__none__" || !form.password) {
      setError("Name, email, role, and password are required."); return;
    }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const body: Record<string, string> = {
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        password: form.password,
        phone: form.phone,
      };
      if (form.branch_id !== "__none__") body.branch_id = form.branch_id;

      const res = await fetch(getApiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; error?: string; message?: string };
      if (!data.success) { setError(data.message ?? data.error ?? "Creation failed"); return; }
      onCreated();
      onClose();
      setForm({ full_name: "", email: "", role: "__none__", password: "", phone: "", branch_id: "__none__" });
    } catch {
      setError("Server connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (!saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>+ New User</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Select role</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Branch</Label>
              <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No branch</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}{b.internal_code ? ` (${b.internal_code})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Password * (min 8 characters)</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} disabled={saving} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating…</> : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main UserManagement Component ─────────────────────────────────────────
export default function UserManagement() {
  const { token } = useAuthStore();
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [branchFilter, setBranchFilter] = useState("__all__");
  const [activeFilter, setActiveFilter] = useState("__all__");
  const [page, setPage]             = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  // Track which user cards have password revealed
  const [revealedPwds, setRevealedPwds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter !== "__all__") params.set("role", roleFilter);
    if (branchFilter !== "__all__") params.set("branch_id", branchFilter);
    if (activeFilter !== "__all__") params.set("is_active", activeFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    return getApiUrl(`/api/admin/users?${params.toString()}`);
  }, [debouncedSearch, roleFilter, branchFilter, activeFilter, page]);

  const { data, isLoading, refetch } = useQuery<UsersResponse>({
    queryKey: ["admin-users", debouncedSearch, roleFilter, branchFilter, activeFilter, page],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${token}` } });
      return res.json() as Promise<UsersResponse>;
    },
    staleTime: 30_000,
  });

  const { data: branchData } = useQuery<BranchesResponse>({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/users/branches"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json() as Promise<BranchesResponse>;
    },
    staleTime: 300_000,
  });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const branches = branchData?.data ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const togglePwdReveal = (id: string) => {
    setRevealedPwds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left: User List ── */}
      <div className={cn("flex flex-col border-r bg-background transition-all duration-200", selectedId ? "w-[420px] shrink-0" : "flex-1")}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold shrink-0">👤 User Management</h2>
          <Button size="sm" onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4 mr-1" />New User
          </Button>
        </div>

        {/* Filters */}
        <div className="border-b px-4 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Roles</SelectItem>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={v => { setBranchFilter(v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={v => { setActiveFilter(v); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Count bar */}
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
          {total.toLocaleString()} user{total !== 1 ? "s" : ""}
          {debouncedSearch && <span className="ml-1">— searching "{debouncedSearch}"</span>}
          {branchFilter !== "__all__" && <span className="ml-1">— {branches.find(b => b.id === branchFilter)?.name ?? ""}</span>}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <UserCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No users found.</p>
            </div>
          ) : (
            users.map(u => {
              const balance = fmtMYR(u.ledger_balance);
              const pwdRevealed = revealedPwds.has(u.id);
              return (
                <div
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(prev => prev === u.id ? null : u.id)}
                  onKeyDown={e => e.key === "Enter" && setSelectedId(prev => prev === u.id ? null : u.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 border-b text-left hover:bg-muted/50 transition-colors cursor-pointer",
                    selectedId === u.id && "bg-primary/5 border-l-2 border-l-primary",
                    !u.is_active && "opacity-50",
                  )}
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm mt-0.5">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{u.full_name}</p>
                      {!u.is_active && <Badge variant="secondary" className="text-[10px] py-0 h-4">Inactive</Badge>}
                    </div>
                    {/* Email + Password row */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                        {u.email ?? "—"}
                      </p>
                      {u.plain_password && (
                        <>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {pwdRevealed ? u.plain_password : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); togglePwdReveal(u.id); }}
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            {pwdRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </>
                      )}
                    </div>
                    {u.branch_name && <p className="text-xs text-muted-foreground truncate">{u.branch_name}</p>}
                  </div>
                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", ROLE_BADGE_COLORS[u.role] ?? "bg-gray-100 text-gray-700 border-gray-200")}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    {balance && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Wallet className="h-2.5 w-2.5" />{balance}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Right: Detail Panel ── */}
      {selectedId && (
        <div className="flex-1 min-w-0 overflow-hidden bg-background">
          <UserDetailPanel
            key={selectedId}
            userId={selectedId}
            onUserUpdated={() => void refetch()}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {!selectedId && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/20">
          <div className="text-center">
            <UserCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a user to view details.</p>
          </div>
        </div>
      )}

      <NewUserModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={() => void refetch()}
        branches={branches}
      />
    </div>
  );
}
