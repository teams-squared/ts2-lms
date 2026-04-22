import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary-hover",
        secondary:
          "bg-surface-muted text-foreground-muted [a&]:hover:bg-border",
        destructive:
          "bg-danger text-danger-foreground focus-visible:ring-danger/20 dark:bg-danger/60 dark:focus-visible:ring-danger/40 [a&]:hover:bg-danger/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-surface-muted [a&]:hover:text-foreground",
        ghost: "[a&]:hover:bg-surface-muted [a&]:hover:text-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

/* ── App-level RoleBadge (pre-existing) ────────────────────────────────── */

import type { Role } from "@/lib/types"
import { ROLE_STYLES } from "@/lib/role-styles"

interface RoleBadgeProps {
  role: Role
  className?: string
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  course_manager: "Course Manager",
  employee: "Employee",
}

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        ROLE_STYLES[role].badge,
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}
