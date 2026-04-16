import Link from "next/link";
import { GraduationCapIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

interface CourseItem {
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  continueUrl: string;
}

interface CourseProgressListProps {
  courses: CourseItem[];
  completedCount: number;
  hasEnrollments: boolean;
  userRole: Role;
}

export function CourseProgressList({
  courses,
  completedCount,
  hasEnrollments,
  userRole,
}: CourseProgressListProps) {
  // Empty state: no enrollments at all
  if (courses.length === 0 && !hasEnrollments) {
    return (
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Your courses
        </h2>
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#2e2e3a] p-8 text-center">
          <GraduationCapIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            No courses have been assigned to you yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {userRole === "admin"
              ? "Browse the catalog to find courses."
              : "Contact your administrator to get enrolled in courses."}
          </p>
          {userRole === "admin" && (
            <Link
              href="/courses"
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Browse the catalog →
            </Link>
          )}
        </div>
      </section>
    );
  }

  // No in-progress courses but completed some (or has enrollments that are all done)
  if (courses.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Your courses
          </h2>
          {completedCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              🎓 {completedCount} completed
            </span>
          )}
        </div>
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#2e2e3a] p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You&apos;re all caught up. Great work!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in animate-init" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Your courses
        </h2>
        {completedCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            🎓 {completedCount} completed
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course, i) => (
          <Link
            key={course.courseId}
            href={course.continueUrl}
            className="group block rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover:border-brand-400/50 dark:hover:border-brand-500/50 p-4 transition-all animate-slide-up animate-init"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1 mb-3">
              {course.courseTitle}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                  style={{ width: `${course.percentComplete}%` }}
                />
              </div>
              <span className="flex-shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                {course.percentComplete}%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {course.completedLessons} of {course.totalLessons} lesson
              {course.totalLessons !== 1 ? "s" : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
