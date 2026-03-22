import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, User, Wallet, Shield, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import PasswordChangeModal from "./PasswordChangeModal";

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

const ALL_ROLES = Object.keys(ROLE_LABELS);

function fmtMYR(val: number | string | null | undefined) {
  if (val == null) return "—";
  return `RM ${Number(val).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
}

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  branch_name: string | null;
  org_name: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  hostess_profile_id: string | null;
  hostess_code: string | null;
  agent_name: string | null;
}

interface LedgerEntry {
  id: string;
  effective_date: string;
  entry_type: string;
  direction: "DR" | "CR";
  amount: string;
  currency: string;
  description: string | null;
  status: string;
}

interface LedgerData {
  account: { balance_cache: string | number; currency: string };
  recentEntries: LedgerEntry[];
  thisMonth: { income: number; deductions: number };
}

interface Props {
  userId: string;
  onUserUpdated: () => void;
  onClose: () => void;
}

type Tab = "info" | "ledger" | "security";

export default function UserDetailPanel({ userId, onUserUpdated, onClose }: Props) {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>("info");
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StaffUser>>({});
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [showPwdModal, setShowPwdModal] = useState(false);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; data: StaffUser };
      if (data.success) { setUser(data.data); setEditForm(data.data); }
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/ledger`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; noLedger?: boolean; isInvestor?: boolean; data: LedgerData | unknown[]; message?: string };
      if (data.success) {
        if (data.noLedger) { setLedgerError(data.message ?? "원장 없음"); setLedger(null); }
        else if (data.isInvestor) { setLedgerError("투자자: 집계 데이터만 표시"); setLedger(null); }
        else setLedger(data.data as LedgerData);
      }
    } catch {
      setLedgerError("원장 데이터 로드 실패");
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => { void fetchUser(); }, [userId]);
  useEffect(() => { if (tab === "ledger" && !ledger && !ledgerLoading) void fetchLedger(); }, [tab]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${user.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) { setEditing(false); await fetchUser(); onUserUpdated(); }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user || !confirm(`${user.full_name} 계정을 비활성화하시겠습니까?`)) return;
    setDeactivating(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${user.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean };
      if (data.success) { await fetchUser(); onUserUpdated(); }
    } finally {
      setDeactivating(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "info",     label: "기본정보", icon: "👤" },
    { key: "ledger",   label: "원장",    icon: "💰" },
    { key: "security", label: "보안",    icon: "🔐" },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <div className="p-6 text-muted-foreground">사용자를 찾을 수 없습니다.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Badge variant={user.is_active ? "default" : "secondary"} className="ml-1">
            {user.is_active ? "활성" : "비활성"}
          </Badge>
          <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b px-6 pt-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-t-md transition-colors",
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ─── TAB 1: 기본정보 ─── */}
        {tab === "info" && (
          <div className="space-y-5">
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>이름</Label>
                    <Input value={editForm.full_name ?? ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>이메일</Label>
                    <Input value={editForm.email ?? ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>전화번호</Label>
                    <Input value={editForm.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>역할</Label>
                    <Select value={editForm.role ?? "__none__"} onValueChange={v => setEditForm(f => ({ ...f, role: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />저장 중…</> : "저장"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setEditForm(user); }}>취소</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  {[
                    ["이름",       user.full_name],
                    ["이메일",     user.email],
                    ["전화번호",   user.phone ?? "—"],
                    ["역할",       ROLE_LABELS[user.role] ?? user.role],
                    ["지점",       user.branch_name ?? "—"],
                    ["소속",       user.org_name ?? "—"],
                    ["상태",       user.is_active ? "✅ 활성" : "❌ 비활성"],
                    ["가입일",     fmtDate(user.created_at)],
                    ["최근 로그인", fmtDate(user.last_login_at)],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <p className="text-xs text-muted-foreground mb-0.5">{label as string}</p>
                      <p className="font-medium">{val as string}</p>
                    </div>
                  ))}
                  {user.role === "hostess" && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">에이전시 코드</p>
                        <p className="font-medium">{user.hostess_code ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">에이전트</p>
                        <p className="font-medium">{user.agent_name ?? "—"}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <User className="h-3.5 w-3.5 mr-1.5" />편집
                  </Button>
                  {user.is_active && (
                    <Button size="sm" variant="destructive" onClick={() => void handleDeactivate()} disabled={deactivating}>
                      {deactivating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                      비활성화
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 2: 원장 ─── */}
        {tab === "ledger" && (
          <div className="space-y-5">
            {ledgerLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!ledgerLoading && ledgerError && (
              <div className="rounded-lg border bg-muted/30 p-6 text-center">
                <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{ledgerError}</p>
              </div>
            )}
            {!ledgerLoading && ledger && (
              <>
                {/* Balance */}
                <Card className="p-5 text-center bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">미지급 잔액</p>
                  <p className="text-3xl font-bold text-primary">{fmtMYR(ledger.account.balance_cache)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ledger.account.currency}</p>
                </Card>

                {/* Monthly summary */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 text-center bg-green-50 border-green-200">
                    <p className="text-xs text-muted-foreground">이번달 수입</p>
                    <p className="text-lg font-semibold text-green-700">{fmtMYR(ledger.thisMonth.income)}</p>
                  </Card>
                  <Card className="p-4 text-center bg-red-50 border-red-200">
                    <p className="text-xs text-muted-foreground">이번달 공제</p>
                    <p className="text-lg font-semibold text-red-700">{fmtMYR(ledger.thisMonth.deductions)}</p>
                  </Card>
                </div>

                {/* Recent entries */}
                <div>
                  <p className="text-sm font-medium mb-2">최근 거래 10건</p>
                  {ledger.recentEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">거래 내역이 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ledger.recentEntries.map(entry => {
                        const isCredit = entry.direction === "CR";
                        return (
                          <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium text-xs">{entry.entry_type.replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(entry.effective_date)}</p>
                            </div>
                            <p className={cn("font-semibold text-sm", isCredit ? "text-green-700" : "text-red-700")}>
                              {isCredit ? "+" : "-"}{fmtMYR(entry.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button size="sm" variant="outline" className="w-full" asChild>
                  <a href="/ledger" className="flex items-center justify-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />전체 원장 보기
                  </a>
                </Button>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 3: 보안 ─── */}
        {tab === "security" && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>패스워드 변경 시 <strong>감사 로그</strong>에 기록됩니다.</span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              {[
                ["이메일",    user.email],
                ["역할",      ROLE_LABELS[user.role] ?? user.role],
                ["계정 상태", user.is_active ? "✅ 활성" : "❌ 비활성"],
                ["가입일",    fmtDate(user.created_at)],
                ["최근 로그인", fmtDate(user.last_login_at)],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-xs text-muted-foreground mb-0.5">{label as string}</p>
                  <p className="font-medium">{val as string}</p>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5"
              onClick={() => setShowPwdModal(true)}
            >
              <Shield className="h-4 w-4 mr-1.5" />패스워드 변경
            </Button>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        open={showPwdModal}
        onClose={() => setShowPwdModal(false)}
        userId={user.id}
        userName={user.full_name}
      />
    </div>
  );
}
