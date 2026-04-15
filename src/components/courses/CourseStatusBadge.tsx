import type { CourseStatus } from "@/lib/types";

const STATUS_STYLES: Record<CourseStatus, string> = {
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  published: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
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
