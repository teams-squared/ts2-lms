"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Progress — design-system Section 8.5.
 *
 * - Default height 6px (h-1.5); pass `h-2` for the "prominent" variant
 * - Track uses `bg-border`, fill uses `bg-primary` (solid, no gradient)
 * - Fill animates via CSS transform (hardware-accelerated) at 400ms ease-out
 * - Supply `aria-label` at the call site for screen readers
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-border",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-transform duration-[400ms] ease-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
