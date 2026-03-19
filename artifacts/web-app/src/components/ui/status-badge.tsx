import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_COLOR_MAP: Record<string, string> = {
  tentative:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checked_in:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  extended:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  checked_out:  "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelled:    "bg-red-500/15 text-red-400 border-red-500/30",
  no_show:      "bg-orange-500/15 text-orange-400 border-orange-500/30",
  dirty:        "bg-rose-500/15 text-rose-400 border-rose-500/30",
  cleaning:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
  clean:        "bg-green-500/15 text-green-400 border-green-500/30",
  inspected:    "bg-teal-500/15 text-teal-400 border-teal-500/30",
  out_of_order: "bg-red-600/20 text-red-300 border-red-600/30",
  direct:       "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  online:       "bg-violet-500/15 text-violet-400 border-violet-500/30",
  walk_in:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  agent:        "bg-purple-500/15 text-purple-400 border-purple-500/30",
  phone:        "bg-pink-500/15 text-pink-400 border-pink-500/30",
  active:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  inactive:     "bg-gray-500/15 text-gray-400 border-gray-500/30",
  true:         "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  false:        "bg-gray-500/15 text-gray-400 border-gray-500/30",
  draft:        "bg-slate-500/20 text-slate-300 border-slate-500/30",
  approved:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  paid:         "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

interface StatusBadgeProps {
  status: string | boolean | null | undefined;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = status === null || status === undefined ? "" : String(status).toLowerCase();
  const colorClass = STATUS_COLOR_MAP[key] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const displayLabel = label ?? key.replace(/_/g, " ");

  return (
    <Badge
      className={cn(
        "border text-xs font-medium capitalize",
        colorClass,
        className
      )}
    >
      {displayLabel}
    </Badge>
  );
}
