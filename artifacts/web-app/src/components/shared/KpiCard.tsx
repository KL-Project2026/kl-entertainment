import * as React from "react";
import { cn } from "@/lib/utils";

/* §12 — KPI Card (v3.0)
 * Standard pattern for dashboard top-strip metrics.
 *
 * - eyebrow label (uppercase, text-tertiary)
 * - large numeric value (font-display + tabular-nums)
 * - optional delta (success/danger/neutral)
 * - optional icon (right side, text-tertiary)
 *
 * §2.3 — Gold value emphasis is reserved for the page's *primary* KPI only.
 * Set `emphasis="gold"` on at most one KpiCard per page.
 */

type Delta = {
  value: string;
  trend?: "up" | "down" | "flat";
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  delta?: Delta;
  deltaSuffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  emphasis?: "default" | "gold";
  className?: string;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  icon: Icon,
  emphasis = "default",
  className,
}: KpiCardProps) {
  const trendColor =
    delta?.trend === "up"
      ? "text-success"
      : delta?.trend === "down"
      ? "text-danger"
      : "text-text-secondary";

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-2 p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-text-tertiary flex-shrink-0" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span
          className={cn(
            "font-display text-3xl font-medium tabular-nums leading-none",
            emphasis === "gold" ? "text-gold" : "text-text-primary"
          )}
        >
          {value}
        </span>
        {delta && (
          <span className={cn("text-xs font-medium", trendColor)}>
            {delta.value}
          </span>
        )}
      </div>
      {deltaSuffix && (
        <p className="mt-1 text-xs text-text-tertiary">{deltaSuffix}</p>
      )}
    </div>
  );
}
