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
  Search, Plus, Loader2, ChevronLeft, ChevronRight, UserCircle, Wallet,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import UserDetailPanel from "./UserDetailPanel";

const ROLE_LABELS: Record<string, string> = {
  super_admin:    "슈퍼관리자",
  admin:          "관리자",
  branch_manager: "지점매니저",
  manager:        "매니저",
  hostess:        "호스티스",
  driver:         "드라이버",
  general:        "일반직원",
  hall:           "홀직원",
  kitchen:        "주방직원",
  investor:       "투자자",
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
  email: string;
  role: string;
  is_active: boolean;
  branch_name: string | null;
  ledger_balance: string | null;
  ledger_currency: string | null;
}

interface UsersResponse {
  success: boolean;
  data: StaffUser[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

function fmtMYR(val: string | number | null | undefined) {
  if (val == null) return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

// ─── New User Form Modal ────────────────────────────────────────────────────
interface NewUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function NewUserModal({ open, onClose, onCreated }: NewUserModalProps) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ full_name: "", email: "", role: "__none__", password: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!form.full_name || !form.email || form.role === "__none__" || !form.password) {
      setError("이름, 이메일, 역할, 비밀번호는 필수입니다."); return;
    }
    if (form.password.length < 8) { setError("비밀번호는 최소 8자 이상이어야 합니다."); return; }
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, role: form.role }),
      });
      const data = await res.json() as { success: boolean; error?: string; message?: string };
      if (!data.success) { setError(data.message ?? data.error ?? "생성 실패"); return; }
      onCreated();
      onClose();
      setForm({ full_name: "", email: "", role: "__none__", password: "", phone: "" });
    } catch {
      setError("서버 연결 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (!saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>+ 새 사용자 생성</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>이름 *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>이메일 *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>전화번호</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>역할 *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>역할 선택</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>비밀번호 * (최소 8자)</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} disabled={saving} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />생성 중…</> : "사용자 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main UserManagement Component ──────────────────────────────────────────
export default function UserManagement() {
  const { token } = useAuthStore();
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [activeFilter, setActiveFilter] = useState("__all__");
  const [page, setPage]             = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter !== "__all__") params.set("role", roleFilter);
    if (activeFilter !== "__all__") params.set("is_active", activeFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    return getApiUrl(`/api/admin/users?${params.toString()}`);
  }, [debouncedSearch, roleFilter, activeFilter, page]);

  const { data, isLoading, refetch } = useQuery<UsersResponse>({
    queryKey: ["admin-users", debouncedSearch, roleFilter, activeFilter, page],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${token}` } });
      return res.json() as Promise<UsersResponse>;
    },
    staleTime: 30_000,
  });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left: User List ── */}
      <div className={cn("flex flex-col border-r bg-background transition-all duration-200", selectedId ? "w-[380px] shrink-0" : "flex-1")}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold shrink-0">👤 사용자 관리</h2>
          <Button size="sm" onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4 mr-1" />새 사용자
          </Button>
        </div>

        {/* Filters */}
        <div className="border-b px-4 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="이름 또는 이메일 검색…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(0); }}>
              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="역할" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체 역할</SelectItem>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={v => { setActiveFilter(v); setPage(0); }}>
              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="상태" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체 상태</SelectItem>
                <SelectItem value="true">활성</SelectItem>
                <SelectItem value="false">비활성</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User count */}
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
          총 {total.toLocaleString()}명
          {debouncedSearch && <span className="ml-1">검색: "{debouncedSearch}"</span>}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <UserCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">사용자가 없습니다.</p>
            </div>
          ) : (
            users.map(u => {
              const balance = fmtMYR(u.ledger_balance);
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedId(prev => prev === u.id ? null : u.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 border-b text-left hover:bg-muted/50 transition-colors",
                    selectedId === u.id && "bg-primary/5 border-l-2 border-l-primary",
                    !u.is_active && "opacity-50",
                  )}
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{u.full_name}</p>
                      {!u.is_active && <Badge variant="secondary" className="text-[10px] py-0 h-4">비활성</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
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
                </button>
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
            <p className="text-sm">사용자를 선택하면 상세 정보가 표시됩니다.</p>
          </div>
        </div>
      )}

      {/* New User Modal */}
      <NewUserModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={() => void refetch()}
      />
    </div>
  );
}
