import * as React from "react";
import { cn } from "@/lib/utils";

/* §9.1 — Page Header (v3.0)
 * Standard structure for every Admin page:
 *   [eyebrow]  Operations
 *   [h1]       Reservations
 *   [subline]  Manage today's bookings and walk-ins.
 *   [actions]  (right-aligned)
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="Operations"
 *     title="Reservations"
 *     description="Manage today's bookings and walk-ins."
 *     actions={<><Button variant="secondary">Export</Button><Button>+ New</Button></>}
 *   />
 */

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
