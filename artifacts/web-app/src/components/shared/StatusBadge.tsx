import React from "react";

type StatusConfig = { bg: string; color: string; label: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  confirmed:       { bg: "#dcfce7", color: "#166534", label: "Confirmed" },
  checked_in:      { bg: "#dbeafe", color: "#1e40af", label: "Checked In" },
  checked_out:     { bg: "#f3f4f6", color: "#374151", label: "Checked Out" },
  cancelled:       { bg: "#fee2e2", color: "#991b1b", label: "Cancelled" },
  tentative:       { bg: "#fef9c3", color: "#854d0e", label: "Tentative" },
  no_show:         { bg: "#fde8d8", color: "#9a3412", label: "No Show" },
  clean:           { bg: "#dcfce7", color: "#166534", label: "Clean" },
  dirty:           { bg: "#fee2e2", color: "#991b1b", label: "Dirty" },
  inspected:       { bg: "#dbeafe", color: "#1e40af", label: "Inspected" },
  in_progress:     { bg: "#fef9c3", color: "#854d0e", label: "In Progress" },
  pending:         { bg: "#fef9c3", color: "#854d0e", label: "Pending" },
  completed:       { bg: "#dbeafe", color: "#1e40af", label: "Completed" },
  active:          { bg: "#dcfce7", color: "#166534", label: "Active" },
  inactive:        { bg: "#f3f4f6", color: "#6b7280", label: "Inactive" },
  paid:            { bg: "#dcfce7", color: "#166534", label: "Paid" },
  partially_paid:  { bg: "#fef9c3", color: "#854d0e", label: "Part Paid" },
  issued:          { bg: "#dbeafe", color: "#1e40af", label: "Issued" },
  draft:           { bg: "#f3f4f6", color: "#6b7280", label: "Draft" },
  void:            { bg: "#fee2e2", color: "#991b1b", label: "Void" },
  settled:         { bg: "#dcfce7", color: "#166534", label: "Settled" },
  present:         { bg: "#dcfce7", color: "#166534", label: "Present" },
  absent:          { bg: "#fee2e2", color: "#991b1b", label: "Absent" },
  late:            { bg: "#fef9c3", color: "#854d0e", label: "Late" },
  half_day:        { bg: "#fde8d8", color: "#9a3412", label: "Half Day" },
  day_off:         { bg: "#f3f4f6", color: "#6b7280", label: "Day Off" },
  early_leave:     { bg: "#fde8d8", color: "#9a3412", label: "Early Leave" },
  incall:          { bg: "#dbeafe", color: "#1e40af", label: "In-Call" },
  outcall:         { bg: "#fef9c3", color: "#854d0e", label: "Out-Call" },
  available:       { bg: "#dcfce7", color: "#166534", label: "Available" },
  booked:          { bg: "#dbeafe", color: "#1e40af", label: "Booked" },
  occupied:        { bg: "#fee2e2", color: "#991b1b", label: "Occupied" },
  maintenance:     { bg: "#fef9c3", color: "#854d0e", label: "Maintenance" },
  closed:          { bg: "#f3f4f6", color: "#6b7280", label: "Closed" },
  percentage:      { bg: "#ede9fe", color: "#5b21b6", label: "%" },
  fixed:           { bg: "#fce7f3", color: "#9d174d", label: "Fixed" },
};

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const key = (status ?? "").toLowerCase().replace(/[\s\-]+/g, "_");
  const s   = STATUS_MAP[key] ?? { bg: "#f3f4f6", color: "#374151", label: status ?? "—" };
  return (
    <span
      style={{
        background:   s.bg,
        color:        s.color,
        padding:      size === "lg" ? "4px 14px" : size === "sm" ? "1px 7px" : "2px 10px",
        borderRadius: 9999,
        fontSize:     size === "lg" ? 13 : size === "sm" ? 10 : 11,
        fontWeight:   600,
        whiteSpace:   "nowrap",
        display:      "inline-block",
      }}
    >
      {s.label || (status ?? "").replace(/_/g, " ")}
    </span>
  );
};

export default StatusBadge;
