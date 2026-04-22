import Link from "next/link";
import { CourseStatusBadge } from "./CourseStatusBadge";
import { CourseThumbnail } from "./CourseThumbnail";
import { LockIcon, AlertTriangleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
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
      className={cn(
        "group block overflow-hidden rounded-lg border bg-card shadow-sm outline-none transition-[transform,box-shadow,border-color] duration-150 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        locked
          ? "border-border opacity-75"
          : "border-border hover:border-border-strong",
      )}
    >
      {/* Thumbnail — design-system Section 8.2.1 */}
      <div className="relative">
        <CourseThumbnail title={title} src={thumbnail} locked={locked} />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <LockIcon className="h-8 w-8 text-white/80" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          {showStatus && <CourseStatusBadge status={status} />}
          {locked && (
            <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted">
              Locked
            </span>
          )}
        </div>
        <h3 className="mb-1 line-clamp-2 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        {description && (
          <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
            {description}
          </p>
        )}
        {locked && lockReason && (
          <p className="mb-1 flex items-start gap-1 line-clamp-2 text-xs text-warning">
            <AlertTriangleIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {lockReason}
          </p>
        )}
        {typeof progressPercent === "number" &&
          typeof totalLessons === "number" &&
          totalLessons > 0 && (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs text-foreground-muted">
                <span>
                  {completedLessons} of {totalLessons} lesson
                  {totalLessons !== 1 ? "s" : ""}
                </span>
                <span className="font-medium text-foreground">
                  {progressPercent}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label="Course progress"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        <p className="text-xs text-foreground-subtle">
          by {createdBy.name || createdBy.email}
        </p>
      </div>
    </Link>
  );
}
