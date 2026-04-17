import type { Role } from "@/lib/types";
import { ROLE_STYLES } from "@/lib/role-styles";

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  course_manager: "Course Manager",
  employee: "Employee",
};

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role].badge} ${className}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
