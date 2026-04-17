import * as React from "react"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/**
 * ProgressBar — design-system Section 8.5.
 *
 * Thin wrapper over the primitive <Progress /> that adds the conventions
 * most call sites want: a fraction label, a percent label, and accessible
 * name. Fill uses brand (`bg-primary`) on a neutral track (`bg-border`).
 *
 * Use `size="md"` (8px) for prominent placements (course card, lesson
 * banner), `size="sm"` (6px, the default) for compact rows.
 */

interface ProgressBarProps {
  /** 0..100 */
  value: number
  /** Human-readable name for screen readers (e.g. "Lesson progress"). */
  label: string
  /** Optional leading caption (e.g. "7 of 12 lessons"). */
  caption?: React.ReactNode
  /** Show the "NN%" suffix to the right of the bar. Default false. */
  showPercent?: boolean
  size?: "sm" | "md"
  className?: string
}

export function ProgressBar({
  value,
  label,
  caption,
  showPercent = false,
  size = "sm",
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const heightClass = size === "md" ? "h-2" : "h-1.5"

  return (
    <div className={cn("w-full", className)}>
      {(caption || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-foreground-muted">
          {caption ? <span>{caption}</span> : <span />}
          {showPercent && (
            <span className="tabular-nums font-medium text-foreground">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <Progress
        value={clamped}
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={heightClass}
      />
    </div>
  )
}
