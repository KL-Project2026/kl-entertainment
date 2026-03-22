import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, User, Wallet, Shield, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import PasswordChangeModal from "./PasswordChangeModal";

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
  plain_password: string | null;
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
  const [showPassword, setShowPassword] = useState(false);

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
        if (data.noLedger) { setLedgerError(data.message ?? "No ledger account"); setLedger(null); }
        else if (data.isInvestor) { setLedgerError("Investor: Summary data only"); setLedger(null); }
        else setLedger(data.data as LedgerData);
      }
    } catch {
      setLedgerError("Failed to load ledger data");
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
    if (!user || !confirm(`Deactivate account for ${user.full_name}?`)) return;
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

  const handlePasswordChanged = (newPwd: string) => {
    setUser(prev => prev ? { ...prev, plain_password: newPwd } : prev);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "info",     label: "Profile",  icon: "👤" },
    { key: "ledger",   label: "Ledger",   icon: "💰" },
    { key: "security", label: "Security", icon: "🔐" },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <div className="p-6 text-muted-foreground">User not found.</div>;

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
            <p className="text-xs text-muted-foreground">{user.email ?? "—"}</p>
          </div>
          <Badge variant={user.is_active ? "default" : "secondary"} className="ml-1">
            {user.is_active ? "Active" : "Inactive"}
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
        {/* ─── TAB 1: Profile ─── */}
        {tab === "info" && (
          <div className="space-y-5">
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={editForm.full_name ?? ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={editForm.email ?? ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={editForm.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
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
                    {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setEditForm(user); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  {([
                    ["Full Name",    user.full_name],
                    ["Email",        user.email ?? "—"],
                    ["Phone",        user.phone ?? "—"],
                    ["Role",         ROLE_LABELS[user.role] ?? user.role],
                    ["Branch",       user.branch_name ?? "—"],
                    ["Organisation", user.org_name ?? "—"],
                    ["Status",       user.is_active ? "✅ Active" : "❌ Inactive"],
                    ["Joined",       fmtDate(user.created_at)],
                    ["Last Login",   fmtDate(user.last_login_at)],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                  {user.role === "hostess" && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Agency Code</p>
                        <p className="font-medium">{user.hostess_code ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Agent</p>
                        <p className="font-medium">{user.agent_name ?? "—"}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <User className="h-3.5 w-3.5 mr-1.5" />Edit
                  </Button>
                  {user.is_active && (
                    <Button size="sm" variant="destructive" onClick={() => void handleDeactivate()} disabled={deactivating}>
                      {deactivating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                      Deactivate
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 2: Ledger ─── */}
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
                <Card className="p-5 text-center bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
                  <p className="text-3xl font-bold text-primary">{fmtMYR(ledger.account.balance_cache)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ledger.account.currency}</p>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 text-center bg-green-50 border-green-200">
                    <p className="text-xs text-muted-foreground">This Month Income</p>
                    <p className="text-lg font-semibold text-green-700">{fmtMYR(ledger.thisMonth.income)}</p>
                  </Card>
                  <Card className="p-4 text-center bg-red-50 border-red-200">
                    <p className="text-xs text-muted-foreground">This Month Deductions</p>
                    <p className="text-lg font-semibold text-red-700">{fmtMYR(ledger.thisMonth.deductions)}</p>
                  </Card>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Recent 10 Transactions</p>
                  {ledger.recentEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions found.</p>
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
                    <ExternalLink className="h-3.5 w-3.5" />View Full Ledger
                  </a>
                </Button>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 3: Security ─── */}
        {tab === "security" && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Password changes are <strong>recorded in the audit log</strong>. Visible to Super Admin only.</span>
            </div>

            {/* Login credentials table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Login Credentials
              </div>
              <div className="divide-y text-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Email</span>
                  <span className="font-mono font-medium flex-1">{user.email ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Password</span>
                  <div className="flex items-center gap-2 flex-1">
                    {user.plain_password ? (
                      <>
                        <span className="font-mono font-medium">
                          {showPassword ? user.plain_password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Not recorded — use Change Password to set</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Role</span>
                  <span className="font-medium flex-1">{ROLE_LABELS[user.role] ?? user.role}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Status</span>
                  <span className="font-medium flex-1">{user.is_active ? "✅ Active" : "❌ Inactive"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Joined</span>
                  <span className="font-medium flex-1">{fmtDate(user.created_at)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground w-24 shrink-0">Last Login</span>
                  <span className="font-medium flex-1">{fmtDate(user.last_login_at)}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5"
              onClick={() => setShowPwdModal(true)}
            >
              <Shield className="h-4 w-4 mr-1.5" />Change Password
            </Button>
          </div>
        )}
      </div>

      <PasswordChangeModal
        open={showPwdModal}
        onClose={() => setShowPwdModal(false)}
        userId={user.id}
        userName={user.full_name}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
}
