import { CheckCircleIcon, ClockIcon, LockIcon } from "@/components/icons";
import type { CourseStatus } from "@/lib/types";

const STATUS_CONFIG: Record<CourseStatus, {
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  draft: {
    className: "bg-warning-subtle text-warning",
    Icon: ClockIcon,
    label: "Draft",
  },
  published: {
    className: "bg-success-subtle text-success",
    Icon: CheckCircleIcon,
    label: "Published",
  },
  archived: {
    className: "bg-surface-muted text-foreground-muted",
    Icon: LockIcon,
    label: "Archived",
  },
};

export function CourseStatusBadge({
  status,
  className = "",
}: {
  status: CourseStatus;
  className?: string;
}) {
  const { className: statusClass, Icon, label } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
