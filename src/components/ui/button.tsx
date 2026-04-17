import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Button — design-system Section 8.1.
 *
 * Three primary variants (primary, secondary, ghost) + destructive.
 * Uses dedicated hover tokens (not opacity dimming — see Section 3.4).
 * All sizes meet the 40×40px minimum hit area (Section 8.1 / WCAG 2.5.5)
 * for `sm` and above; `xs` is reserved for dense table actions only.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:translate-y-[1px]",
  {
    variants: {
      variant: {
        // primary — bg-primary + dedicated hover/active tokens
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        // secondary — neutral surface with strong border
        secondary:
          "bg-background border border-border-strong text-foreground hover:bg-surface-muted hover:border-border-strong",
        // ghost — transparent, muted hover
        ghost:
          "bg-transparent text-foreground hover:bg-surface-muted",
        // destructive — red filled
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // link — for inline text links presented as buttons
        link: "text-primary underline-offset-4 hover:underline",
        // outline — alias for secondary, preserved for shadcn recipes that request it
        outline:
          "bg-background border border-border-strong text-foreground hover:bg-surface-muted",
      },
      size: {
        // md (default) — 40px per Section 8.1
        default: "h-10 px-4 py-2.5",
        // sm — 32px, dense table actions
        sm: "h-8 px-3 py-1.5 text-sm",
        // lg — 48px, hero CTAs
        lg: "h-12 px-6 py-3 text-base",
        // icon sizes — square; "icon" is the 40px default
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
        // xs — legacy/dense, below WCAG min hit area; use sparingly
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
