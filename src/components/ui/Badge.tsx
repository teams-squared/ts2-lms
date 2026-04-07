import type { Role } from "@/lib/types";
import { ROLE_STYLES } from "@/lib/role-styles";

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role].badge} ${className}`}
    >
      {role}
    </span>
  );
}
