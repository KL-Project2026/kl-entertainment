import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
  Clock,
  LogIn,
  LogOut,
  TrendingUp,
  X,
} from "lucide-react";
import { ListPageWrapper, type ColumnDef } from "@/components/shared/list-page-wrapper";
import { StatusBadge } from "@/components/ui/status-badge";

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
  profilePhoto: string | null;
  notes: string | null;
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
            <DateInput value={form.hireDate} onChange={(e) => f("hireDate", e.target.value)} />
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
            <label htmlFor="penalty" className="text-sm text-muted-foreground">
              Penalty applies for lateness (&gt;30 min)
            </label>
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

type StaffRow = Record<string, unknown>;

function StaffCard({
  staff,
  onClock,
  onEarnings,
  onEdit,
}: {
  staff: StaffMember;
  onClock: () => void;
  onEarnings: () => void;
  onEdit: () => void;
}) {
  const nickname = staff.notes?.match(/Nickname:\s*(.+)/)?.[1];
  return (
    <Card className="p-4 space-y-3 hover:border-white/20 transition-colors">
      <div className="flex items-start gap-3">
        {/* Profile photo */}
        <div className="shrink-0">
          {staff.profilePhoto ? (
            <img
              src={staff.profilePhoto}
              alt={staff.fullName}
              className="w-12 h-12 rounded-full object-cover border border-white/10 bg-white/5"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.fullName)}&background=1a1a2e&color=d4a84b&size=48`; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg font-bold text-white/40">
              {staff.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium truncate">{staff.fullName}</p>
              {nickname && <p className="text-xs text-primary/70">"{nickname}"</p>}
              <p className="text-xs text-muted-foreground">{staff.employeeCode ?? "—"}</p>
            </div>
            <StatusBadge
              status={staff.role}
              className={`${ROLE_COLORS[staff.role] ?? ROLE_COLORS.general} shrink-0`}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {staff.phone && <p>📞 {staff.phone}</p>}
        <p className="capitalize">{staff.employmentType.replace("_", " ")}</p>
        {staff.agentName && <p className="text-purple-400">Agent: {staff.agentName}</p>}
      </div>

      <div className="flex gap-1.5 pt-1">
        <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={onClock}>
          <Clock className="w-3 h-3" /> Attend
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={onEarnings}>
          <TrendingUp className="w-3 h-3" /> Earnings
        </Button>
        <Button size="sm" variant="outline" className="text-xs px-2" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </Card>
  );
}

const STAFF_COLUMNS: ColumnDef<StaffRow>[] = [
  {
    key: "fullName",
    label: "Name",
    render: (row) => {
      const nickname = (row.notes as string | null)?.match(/Nickname:\s*(.+)/)?.[1];
      const photo = row.profilePhoto as string | null;
      const name = row.fullName as string;
      return (
        <div className="flex items-center gap-3">
          {photo ? (
            <img
              src={photo}
              alt={name}
              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a2e&color=d4a84b&size=36`; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white/40 shrink-0">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-medium">{name}</p>
            {nickname && <p className="text-xs text-primary/60">"{nickname}"</p>}
            <p className="text-xs text-muted-foreground">{(row.employeeCode as string) || "—"}</p>
          </div>
        </div>
      );
    },
  },
  {
    key: "role",
    label: "Role",
    render: (row) => (
      <StatusBadge
        status={row.role as string}
        className={ROLE_COLORS[row.role as string] ?? ROLE_COLORS.general}
      />
    ),
  },
  {
    key: "employmentType",
    label: "Employment",
    render: (row) => (
      <span className="capitalize">{(row.employmentType as string).replace("_", " ")}</span>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (row) => <span>{(row.phone as string) || "—"}</span>,
  },
  {
    key: "agentName",
    label: "Agent",
    render: (row) => (
      <span className={row.agentName ? "text-purple-400" : "text-muted-foreground/50"}>
        {(row.agentName as string) || "—"}
      </span>
    ),
  },
];

const STAFF_ROLE_OPTIONS = [
  { value: "hostess", label: "Hostess" },
  { value: "driver", label: "Driver" },
  { value: "manager", label: "Manager" },
  { value: "kitchen", label: "Kitchen" },
  { value: "hall", label: "Hall" },
  { value: "general", label: "General" },
];

export default function Staff() {
  const { t } = useTranslation();
  const { token, user } = useAuthStore();
  const [, navigate] = useLocation();
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
    queryKey: ["staff", branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter !== "__all__") params.set("branch_id", branchFilter);
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
  const staffRows = allStaff as unknown as StaffRow[];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Branch filter */}
        <div className="mb-4 flex justify-end">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ListPageWrapper
          title={t("pages.staff.title")}
          subtitle={`${allStaff.length} staff members`}
          data={staffRows}
          columns={STAFF_COLUMNS}
          cardRenderer={(row) => {
            const s = row as unknown as StaffMember;
            return (
              <StaffCard
                staff={s}
                onClock={() => setClockStaff(s)}
                onEarnings={() => setEarningsStaff(s)}
                onEdit={() => { setEditStaff(s); setShowForm(true); }}
              />
            );
          }}
          filterKey="role"
          filterLabel="Role"
          filterOptions={STAFF_ROLE_OPTIONS}
          searchKeys={["fullName", "phone", "employeeCode"]}
          searchPlaceholder="Search staff..."
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/staff/${(row as { id: string }).id}`)}
          onAddNew={() => { setEditStaff(undefined); setShowForm(true); }}
          addNewLabel="Add Staff"
          emptyIcon={<Users className="w-12 h-12" />}
          emptyMessage="No staff members found"
        />
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
