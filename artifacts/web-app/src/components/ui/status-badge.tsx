import { cn } from "@/lib/utils";

/* §7.4 — StatusBadge (v3.0)
 * 4 status groups only: success / warning / danger / neutral.
 * Color is paired with text label (§14 — color-blind safe). */

type StatusGroup = "success" | "warning" | "danger" | "neutral";

const STATUS_GROUP_MAP: Record<string, StatusGroup> = {
  // success — confirmed, active, paid, settled, present, available, completed
  confirmed:    "success",
  checked_in:   "success",
  active:       "success",
  paid:         "success",
  approved:     "success",
  settled:      "success",
  present:      "success",
  available:    "success",
  completed:    "success",
  clean:        "success",
  inspected:    "success",
  issued:       "success",
  true:         "success",

  // warning — tentative, pending, partial, in-progress, late, maintenance
  tentative:       "warning",
  pending:         "warning",
  partially_paid:  "warning",
  in_progress:     "warning",
  late:            "warning",
  maintenance:     "warning",
  outcall:         "warning",
  half_day:        "warning",
  cleaning:        "warning",
  extended:        "warning",

  // danger — cancelled, no_show, void, absent, dirty, occupied, blacklisted
  cancelled:    "danger",
  no_show:      "danger",
  void:         "danger",
  absent:       "danger",
  dirty:        "danger",
  occupied:     "danger",
  blacklisted:  "danger",
  out_of_order: "danger",

  // neutral — checked_out, inactive, draft, day_off, closed, archived
  checked_out: "neutral",
  inactive:    "neutral",
  draft:       "neutral",
  day_off:     "neutral",
  closed:      "neutral",
  archived:    "neutral",
  false:       "neutral",

  // Source / channel labels — neutral by spec (§7.4)
  direct:   "neutral",
  online:   "neutral",
  walk_in:  "neutral",
  agent:    "neutral",
  phone:    "neutral",
  incall:   "neutral",
};

const GROUP_STYLE: Record<StatusGroup, string> = {
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger:  "bg-danger/10 text-danger border-danger/25",
  neutral: "bg-surface-3 text-text-secondary border-border-default",
};

interface StatusBadgeProps {
  status: string | boolean | null | undefined;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = status === null || status === undefined ? "" : String(status).toLowerCase();
  const group: StatusGroup = STATUS_GROUP_MAP[key] ?? "neutral";
  const displayLabel = label ?? key.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        "h-[22px] px-2.5 rounded-full border",
        "text-[11px] font-semibold tracking-wide capitalize",
        GROUP_STYLE[group],
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
