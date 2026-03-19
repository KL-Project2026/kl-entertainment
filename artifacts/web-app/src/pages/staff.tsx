import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Clock,
  LogIn,
  LogOut,
  TrendingUp,
  X,
} from "lucide-react";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function getAuthHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface StaffMember {
  id: string;
  branchId: string;
  employeeCode: string | null;
  fullName: string;
  phone: string | null;
  role: string;
  employmentType: string;
  penaltyApplies: boolean;
  agentId: string | null;
  agentName: string | null;
  isActive: boolean;
  baseSalary: number | null;
  salaryCurrency: string;
  commissionConfig: Record<string, unknown> | null;
  hireDate: string | null;
}

interface Branch {
  id: string;
  name: string;
  internalCode: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  admin: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  branch_manager: "bg-gold-500/20 text-yellow-300 border-yellow-500/30",
  manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  hostess: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  driver: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  kitchen: "bg-green-500/20 text-green-300 border-green-500/30",
  hall: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function ClockModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const clockIn = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/staff/${staff.id}/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({ branchId: staff.branchId }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", staff.id] });
      onClose();
    },
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/staff/${staff.id}/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", staff.id] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="p-6 w-80 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">{staff.fullName}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground">Manage attendance for {new Date().toLocaleDateString()}</p>
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2"
            onClick={() => clockIn.mutate()}
            disabled={clockIn.isPending}
          >
            <LogIn className="w-4 h-4" /> Clock In
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => clockOut.mutate()}
            disabled={clockOut.isPending}
          >
            <LogOut className="w-4 h-4" /> Clock Out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function EarningsModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const { token } = useAuthStore();
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const { data } = useQuery({
    queryKey: ["staff-earnings", staff.id],
    queryFn: async () => {
      const r = await fetch(`/api/staff/${staff.id}/earnings?from=${firstOfMonth}&to=${today}`, {
        headers: getAuthHeader(token),
      });
      return r.json();
    },
  });

  const earnings = data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="p-6 w-96 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Earnings — {staff.fullName}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{firstOfMonth} to {today}</p>
        {earnings ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Sessions</p>
                <p className="font-bold text-xl">{earnings.sessions}</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Gross Earnings</p>
                <p className="font-bold text-xl text-emerald-400">RM {earnings.grossEarnings.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Agent Deductions</p>
                <p className="font-bold text-xl text-orange-400">-RM {earnings.agentDeductions.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Penalties</p>
                <p className="font-bold text-xl text-red-400">-RM {earnings.penalties.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">Net Earnings</p>
              <p className="text-3xl font-bold text-primary">RM {earnings.netEarnings.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        )}
      </Card>
    </div>
  );
}

function StaffForm({ branches, onClose, editStaff }: {
  branches: Branch[];
  onClose: () => void;
  editStaff?: StaffMember;
}) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: editStaff?.fullName ?? "",
    phone: editStaff?.phone ?? "",
    role: editStaff?.role ?? "hostess",
    employmentType: editStaff?.employmentType ?? "contract",
    branchId: editStaff?.branchId ?? branches[0]?.id ?? "",
    baseSalary: editStaff?.baseSalary?.toString() ?? "",
    penaltyApplies: editStaff?.penaltyApplies ?? false,
    hireDate: editStaff?.hireDate ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editStaff ? `/api/staff/${editStaff.id}` : "/api/staff";
      const method = editStaff ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
        body: JSON.stringify({
          ...form,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : null,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    },
  });

  const f = (field: string, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">{editStaff ? "Edit" : "New"} Staff Member</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Full Name *</label>
            <Input value={form.fullName} onChange={(e) => f("fullName", e.target.value)} placeholder="Full Name" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone</label>
            <Input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+60..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hire Date</label>
            <Input type="date" value={form.hireDate} onChange={(e) => f("hireDate", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch *</label>
            <Select value={form.branchId} onValueChange={(v) => f("branchId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Role *</label>
            <Select value={form.role} onValueChange={(v) => f("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["hostess", "driver", "manager", "kitchen", "hall", "general"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Employment Type</label>
            <Select value={form.employmentType} onValueChange={(v) => f("employmentType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["full_time", "part_time", "contract", "freelance"].map((t) => (
                  <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Base Salary (MYR)</label>
            <Input
              type="number"
              value={form.baseSalary}
              onChange={(e) => f("baseSalary", e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.penaltyApplies}
              onChange={(e) => f("penaltyApplies", e.target.checked)}
              id="penalty"
              className="rounded"
            />
            <label htmlFor="penalty" className="text-sm text-muted-foreground">Penalty applies for lateness (&gt;30 min)</label>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.fullName}
        >
          {save.isPending ? "Saving..." : (editStaff ? "Save Changes" : "Create Staff")}
        </Button>
      </Card>
    </div>
  );
}

export default function Staff() {
  const { token, user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [branchFilter, setBranchFilter] = useState(user?.branchId ?? "__all__");
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | undefined>();
  const [clockStaff, setClockStaff] = useState<StaffMember | undefined>();
  const [earningsStaff, setEarningsStaff] = useState<StaffMember | undefined>();

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff", branchFilter, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter !== "__all__") params.set("branch_id", branchFilter);
      if (roleFilter !== "__all__") params.set("role", roleFilter);
      const r = await fetch(`/api/staff?${params}`, { headers: getAuthHeader(token) });
      return r.json();
    },
  });

  const branches: Branch[] = (branchesData?.data ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    name: b.name as string,
    internalCode: b.internalCode as string,
  }));

  const allStaff: StaffMember[] = staffData?.data ?? [];
  const filtered = allStaff.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone?.includes(search) ?? false)
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Staff Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{allStaff.length} staff members</p>
          </div>
          <Button onClick={() => { setEditStaff(undefined); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Roles</SelectItem>
              {["hostess", "driver", "manager", "kitchen", "hall", "general"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Staff Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading staff...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No staff members found</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => (
              <Card key={s.id} className="p-4 space-y-3 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.employeeCode ?? "—"}</p>
                  </div>
                  <Badge className={`text-xs border ${ROLE_COLORS[s.role] ?? ROLE_COLORS.general}`}>
                    {s.role}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  {s.phone && <p>📞 {s.phone}</p>}
                  <p className="capitalize">{s.employmentType.replace("_", " ")}</p>
                  {s.agentName && <p className="text-purple-400">Agent: {s.agentName}</p>}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1"
                    onClick={() => setClockStaff(s)}
                  >
                    <Clock className="w-3 h-3" /> Attend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1"
                    onClick={() => setEarningsStaff(s)}
                  >
                    <TrendingUp className="w-3 h-3" /> Earnings
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs px-2"
                    onClick={() => { setEditStaff(s); setShowForm(true); }}
                  >
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <StaffForm
          branches={branches}
          editStaff={editStaff}
          onClose={() => { setShowForm(false); setEditStaff(undefined); }}
        />
      )}
      {clockStaff && <ClockModal staff={clockStaff} onClose={() => setClockStaff(undefined)} />}
      {earningsStaff && <EarningsModal staff={earningsStaff} onClose={() => setEarningsStaff(undefined)} />}
    </DashboardLayout>
  );
}
