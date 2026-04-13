import Link from "next/link";
import { CourseStatusBadge } from "./CourseStatusBadge";
import type { CourseStatus } from "@/lib/types";

interface CourseCardProps {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  thumbnail: string | null;
  createdBy: { name: string | null; email: string };
}

export function CourseCard({
  id,
  title,
  description,
  status,
  thumbnail,
  createdBy,
}: CourseCardProps) {
  return (
    <Link
      href={`/courses/${id}`}
      className="group block rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated transition-shadow overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 dark:bg-[#18181f] flex items-center justify-center overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-3xl text-gray-300 dark:text-gray-600">
            {title[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <CourseStatusBadge status={status} />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
            {description}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          by {createdBy.name || createdBy.email}
        </p>
      </div>
    </Link>
  );
}
