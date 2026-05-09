import * as React from "react"

import { cn } from "@/lib/utils"

/* §7.3 — Input (v3.0)
 * h-9, surface-3 background, gold focus ring (3px gold-muted halo). */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-border-default bg-surface-3 px-3 py-1",
          "text-sm text-text-primary placeholder:text-text-tertiary",
          "transition-colors duration-100",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary",
          "focus-visible:outline-none focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold-muted",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
