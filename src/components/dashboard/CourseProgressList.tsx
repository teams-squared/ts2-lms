import Link from "next/link";
import {
  GraduationCapIcon,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  CATEGORY_ACCENT_COLORS,
} from "@/components/icons";
import type { Role } from "@/lib/types";

interface CourseItem {
  courseId: string;
  courseTitle: string;
  category: string | null;
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

function resolveCategoryKey(category: string | null): string {
  if (!category) return "book";
  const key = category.toLowerCase();
  return key in CATEGORY_ICONS ? key : "book";
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
            <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
              <span className="animate-float" aria-hidden="true">🎓</span>
              {completedCount} completed
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
          <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
            <span className="animate-float" aria-hidden="true">🎓</span>
            {completedCount} completed
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course, i) => {
          const categoryKey = resolveCategoryKey(course.category);
          const CategoryIcon = CATEGORY_ICONS[categoryKey] ?? CATEGORY_ICONS.book;
          const iconBgColor = CATEGORY_COLORS[categoryKey];
          const accentColor = CATEGORY_ACCENT_COLORS[categoryKey];
          const isAlmostDone = course.percentComplete >= 75 && course.percentComplete < 100;
          const isInProgress = course.percentComplete > 0 && course.percentComplete < 100;

          return (
            <Link
              key={course.courseId}
              href={course.continueUrl}
              className="group relative block rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-400/50 dark:hover:border-brand-500/50 p-4 pt-5 transition-all animate-slide-up animate-init hover-lift overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Top accent strip in category color */}
              <div
                aria-hidden
                className="absolute top-0 inset-x-0 h-1"
                style={{ background: accentColor }}
              />

              <div className="flex items-start gap-3 mb-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: iconBgColor }}
                >
                  <CategoryIcon
                    className="w-5 h-5"
                    style={{ color: "var(--icon-fg)" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2 leading-snug">
                    {course.courseTitle}
                  </h3>
                </div>
                {isAlmostDone && (
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 animate-glow whitespace-nowrap"
                    title="You're almost done!"
                  >
                    <span aria-hidden="true">⚡</span>
                    Almost
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 relative h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-700"
                    style={{ width: `${course.percentComplete}%` }}
                  />
                  {isInProgress && (
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer pointer-events-none" />
                  )}
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
          );
        })}
      </div>
    </section>
  );
}
