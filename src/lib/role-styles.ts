import type { Role } from "@/lib/types";

/**
 * Shared Tailwind class sets for each role.
 * Extracted from AppSidebar so all role-coloured UI stays in sync.
 */
export const ROLE_STYLES: Record<Role, { badge: string; dot: string; avatar: string }> = {
  admin: {
    badge: "bg-brand-100 text-brand-700",
    dot: "bg-brand-500",
    avatar: "bg-brand-200 text-brand-800",
  },
  course_manager: {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    avatar: "bg-blue-200 text-blue-800",
  },
  employee: {
    badge: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
    avatar: "bg-gray-200 text-gray-700",
  },
} as const;
