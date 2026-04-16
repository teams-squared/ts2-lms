import Image from "next/image";
import Link from "next/link";
import { CourseStatusBadge } from "./CourseStatusBadge";
import { LockIcon, GraduationCapIcon } from "@/components/icons";
import type { CourseStatus } from "@/lib/types";

interface CourseCardProps {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  thumbnail: string | null;
  createdBy: { name: string | null; email: string };
  locked?: boolean;
  lockReason?: string;
  showStatus?: boolean;
  progressPercent?: number;
  completedLessons?: number;
  totalLessons?: number;
}

export function CourseCard({
  id,
  title,
  description,
  status,
  thumbnail,
  createdBy,
  locked,
  lockReason,
  showStatus = true,
  progressPercent,
  completedLessons,
  totalLessons,
}: CourseCardProps) {
  return (
    <Link
      href={`/courses/${id}`}
      className={`group block rounded-xl border bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift overflow-hidden ${
        locked
          ? "border-gray-300/60 dark:border-[#3a3a48] opacity-75"
          : "border-gray-200/80 dark:border-[#2e2e3a]"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100 dark:bg-[#18181f] overflow-hidden">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover ${locked ? "grayscale" : ""}`}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-950/40 dark:to-brand-900/30">
            <GraduationCapIcon className="w-10 h-10 text-brand-400 dark:text-brand-500 mb-1.5" />
            <span className="text-xs font-medium text-brand-500 dark:text-brand-400 px-3 text-center line-clamp-2 max-w-[80%]">
              {title}
            </span>
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 dark:bg-black/40">
            <LockIcon className="w-8 h-8 text-white/80" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          {showStatus && <CourseStatusBadge status={status} />}
          {locked && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              Locked
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">
            {description}
          </p>
        )}
        {locked && lockReason && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 line-clamp-2">
            {lockReason}
          </p>
        )}
        {typeof progressPercent === "number" && typeof totalLessons === "number" && totalLessons > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                {completedLessons} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {progressPercent}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          by {createdBy.name || createdBy.email}
        </p>
      </div>
    </Link>
  );
}
