import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* §7.4 — Badge / pill (v3.0)
 * 22px height, fully rounded, 4 status groups (success/warning/danger/neutral).
 * Variant names kept stable for back-compat: existing call sites use
 * `default`, `secondary`, `destructive`, `outline`. */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 whitespace-nowrap",
    "h-[22px] px-2.5 rounded-full border",
    "text-[11px] font-semibold tracking-wide",
    "transition-colors duration-100",
    "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-muted",
  ].join(" "),
  {
    variants: {
      variant: {
        // success-styled (gold tint) — used for primary KPI labels
        default:
          "bg-gold-muted text-gold border-gold/25",
        // neutral
        secondary:
          "bg-surface-3 text-text-secondary border-border-default",
        // danger
        destructive:
          "bg-danger/10 text-danger border-danger/25",
        // outline / generic
        outline:
          "bg-transparent text-text-primary border-border-default",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
