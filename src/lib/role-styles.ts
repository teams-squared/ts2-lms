import type { Role } from "@/lib/types";

/**
 * Shared Tailwind class sets for each role.
 * Extracted from AppSidebar so all role-coloured UI stays in sync.
 */
export const ROLE_STYLES: Record<Role, { badge: string; dot: string; avatar: string }> = {
  admin: {
    badge: "bg-primary-subtle text-primary-subtle-foreground",
    dot: "bg-primary",
    avatar: "bg-primary-subtle text-primary-subtle-foreground",
  },
  course_manager: {
    badge: "bg-surface-muted text-info",
    dot: "bg-info",
    avatar: "bg-surface-muted text-info",
  },
  employee: {
    badge: "bg-surface-muted text-foreground-muted",
    dot: "bg-foreground-subtle",
    avatar: "bg-surface-muted text-foreground-muted",
  },
} as const;
