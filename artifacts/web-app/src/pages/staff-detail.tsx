import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, User, Phone, TrendingUp, Clock, LogIn, LogOut, Edit2, X, Save } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { AttendanceTab } from "@/components/shared/AttendanceTab";
import { StaffAccountTab } from "@/components/shared/AccountTab";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  admin: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  branch_manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  manager: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  hostess: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  driver: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  kitchen: "bg-green-500/20 text-green-300 border-green-500/30",
  hall: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function DetailRow({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("info");

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => {
      const r = await fetch(`/api/staff/${id}`);
      if (!r.ok) throw new Error("Not found");
      return (await r.json()).data;
    },
    enabled: !!id,
  });

  const { data: earningsData } = useQuery({
    queryKey: ["staff-earnings", id],
    queryFn: async () => {
      const r = await fetch(`/api/staff/${id}/earnings`);
      if (!r.ok) return null;
      return (await r.json()).data;
    },
    enabled: !!id,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["staff-attendance", id],
    queryFn: async () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const to = today.toISOString().slice(0, 10);
      const r = await fetch(`/api/staff/${id}/attendance?from=${from}&to=${to}`);
      if (!r.ok) return [];
      return (await r.json()).data ?? [];
    },
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff", id] });

  const clockInMut = useMutation({
    mutationFn: () => fetch(`/api/staff/${id}/clock-in`, { method: "POST" }).then(r => r.json()),
    onSuccess: invalidate,
  });
  const clockOutMut = useMutation({
    mutationFn: () => fetch(`/api/staff/${id}/clock-out`, { method: "POST" }).then(r => r.json()),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: () =>
      fetch(`/api/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      }).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const startEditing = () => {
    if (!staff) return;
    setEditForm({
      fullName: staff.fullName ?? "",
      phone: staff.phone ?? "",
      email: staff.email ?? "",
      role: staff.role ?? "",
      employmentType: staff.employmentType ?? "",
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-white/5 rounded" />
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !staff) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">
          <p>Staff member not found.</p>
          <Button variant="ghost" onClick={() => navigate("/staff")} className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Staff
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/staff")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold">{staff.fullName}</h1>
                <Badge className={`border text-xs capitalize ${ROLE_COLORS[staff.role] ?? ""}`}>
                  {staff.role?.replace(/_/g, " ")}
                </Badge>
                {!staff.isActive && (
                  <Badge className="border text-xs bg-red-500/10 text-red-400 border-red-500/30">Inactive</Badge>
                )}
              </div>
              {staff.employeeCode && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{staff.employeeCode}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => clockInMut.mutate()} disabled={clockInMut.isPending} className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              <LogIn className="w-3.5 h-3.5" /> Clock In
            </Button>
            <Button size="sm" variant="outline" onClick={() => clockOutMut.mutate()} disabled={clockOutMut.isPending} className="gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
              <LogOut className="w-3.5 h-3.5" /> Clock Out
            </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 24, flexWrap: "wrap" }}>
          {([ ["info", "Profile"], ["attendance", "Attendance"], ["account", "Account"] ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: "10px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === key ? "#D1AE38" : "transparent"}`,
              marginBottom: -2, fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? "#D1AE38" : "#6b7280",
              cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {activeTab === "info" && (<div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Profile
            </h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Full Name</label>
                  <Input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Email</label>
                  <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Employment Type</label>
                  <Select value={editForm.employmentType} onValueChange={v => setEditForm(f => ({ ...f, employmentType: v }))}>
                    <SelectTrigger className="bg-black/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Full Name" value={staff.fullName} />
                <DetailRow label="Legal Name" value={staff.legalName} />
                <DetailRow label="Nationality" value={staff.nationality} />
                <DetailRow label="Employment Type" value={staff.employmentType?.replace(/_/g, " ")} />
                <DetailRow label="Hire Date" value={staff.hireDate ? formatDate(staff.hireDate) : null} />
                <DetailRow label="Agent" value={staff.agentName} />
              </>
            )}
          </Card>

          {/* Contact & Pay */}
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Contact & Pay
            </h3>
            <DetailRow label="Phone" value={staff.phone} />
            <DetailRow label="WhatsApp" value={staff.whatsapp} />
            <DetailRow label="Email" value={staff.email} />

            <h3 className="font-display font-semibold mt-5 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Compensation
            </h3>
            <DetailRow label="Base Salary" value={staff.baseSalary ? formatCurrency(staff.baseSalary) : null} />
            <DetailRow label="Currency" value={staff.salaryCurrency} />
            {earningsData && (
              <>
                <DetailRow label="This Month Earnings" value={formatCurrency(earningsData.totalEarnings ?? 0)} />
                <DetailRow label="Sessions" value={earningsData.sessions} />
              </>
            )}
          </Card>
        </div>

        {/* Attendance this month */}
        {attendanceData && attendanceData.length > 0 && (
          <Card className="p-5 bg-black/40 border-white/5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Attendance (This Month)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Clock In</th>
                    <th className="pb-2">Clock Out</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.slice(0, 15).map((a: Record<string, string>) => (
                    <tr key={a.id} className="border-b border-white/5 text-sm">
                      <td className="py-2 pr-4">{formatDate(a.workDate)}</td>
                      <td className="py-2 pr-4 capitalize">{a.status}</td>
                      <td className="py-2 pr-4">{a.clockInActual ? new Date(a.clockInActual).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="py-2">{a.clockOutActual ? new Date(a.clockOutActual).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        </div>)}

        {activeTab === "attendance" && (
          <AttendanceTab staffId={id!} />
        )}

        {activeTab === "account" && (
          <StaffAccountTab staffId={id!} />
        )}
      </div>
    </DashboardLayout>
  );
}
