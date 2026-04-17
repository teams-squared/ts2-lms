import * as React from "react"
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  Flag,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * StatusBadge — design-system Section 8.9.
 *
 * Pairs colour + icon + text (never colour alone, per accessibility rules).
 * 22px tall, rounded-full pill, uppercase-free concise label.
 *
 * Use for course/lesson/enrollment status surfaces across the app. For
 * free-form badges (role, category, tag), prefer `<Badge />` directly.
 */

export type StatusKind =
  | "completed"
  | "in-progress"
  | "not-started"
  | "overdue"
  | "required"

interface StatusConfig {
  icon: LucideIcon
  label: string
  classes: string
}

const STATUS_MAP: Record<StatusKind, StatusConfig> = {
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    classes: "bg-success-subtle text-success",
  },
  "in-progress": {
    icon: Clock,
    label: "In progress",
    classes: "bg-primary-subtle text-primary-subtle-foreground",
  },
  "not-started": {
    icon: Circle,
    label: "Not started",
    classes: "bg-surface-muted text-foreground-muted",
  },
  overdue: {
    icon: AlertCircle,
    label: "Overdue",
    classes: "bg-danger-subtle text-danger",
  },
  required: {
    icon: Flag,
    label: "Required",
    classes: "bg-warning-subtle text-warning",
  },
}

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKind
  /** Override the default label (e.g. "Due in 3 days" for overdue). */
  label?: string
  /** Hide the icon for extra-compact contexts. Default false. */
  hideIcon?: boolean
}

export function StatusBadge({
  status,
  label,
  hideIcon = false,
  className,
  ...rest
}: StatusBadgeProps) {
  const cfg = STATUS_MAP[status]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.classes,
        className,
      )}
      {...rest}
    >
      {!hideIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      <span>{label ?? cfg.label}</span>
    </span>
  )
}
