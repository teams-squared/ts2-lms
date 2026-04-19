import type { CourseStatus } from "@/lib/types";

const STATUS_STYLES: Record<CourseStatus, string> = {
  draft: "bg-warning-subtle text-warning",
  published: "bg-success-subtle text-success",
  archived: "bg-surface-muted text-foreground-muted",
};

export function CourseStatusBadge({
  status,
  className = "",
}: {
  status: CourseStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]} ${className}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
