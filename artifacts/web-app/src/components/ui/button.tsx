import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* §7.1 — Button Variants (v3.0)
 * Spec calls for 4 variants; we keep the 6 cva names for back-compat
 * (existing pages use `outline` and `link`) but render outline as
 * secondary and link as a text link with no decoration. */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "transition-colors duration-100",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-muted focus-visible:border-gold",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // primary — gold action, 1~2 per page
        default:
          "bg-gold text-gold-foreground hover:bg-gold-hover",
        // destructive — tinted danger, never solid red
        destructive:
          "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15",
        // secondary (= outline alias)
        outline:
          "border border-border-default bg-transparent text-text-primary hover:bg-surface-3 hover:border-border-strong",
        secondary:
          "border border-border-default bg-transparent text-text-primary hover:bg-surface-3 hover:border-border-strong",
        // ghost — cancel/close/inline
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface-3 hover:text-text-primary",
        // link — text link
        link:
          "text-text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-11 px-6",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
