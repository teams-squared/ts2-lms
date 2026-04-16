import Link from "next/link";
import { ChevronRightIcon, GraduationCapIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

interface CourseItem {
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  continueUrl: string;
}

interface CourseProgressGridProps {
  courses: CourseItem[];
  hasEnrollments: boolean;
  userRole: Role;
}

export function CourseProgressGrid({ courses, hasEnrollments, userRole }: CourseProgressGridProps) {
  // Empty state only when there's no hero course either (0 total in-progress)
  if (courses.length === 0 && !hasEnrollments) {
    return (
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Continue Learning
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

  if (courses.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Continue Learning
        </h2>
        {courses.length > 5 && (
          <Link
            href="/courses?tab=my"
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-0.5"
          >
            View all
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courses.slice(0, 5).map((course, i) => (
          <Link
            key={course.courseId}
            href={course.continueUrl}
            className="group block rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift p-5 transition-all animate-slide-up animate-init"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                {course.courseTitle}
              </h3>
              <span className="flex-shrink-0 text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                {course.percentComplete}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span>
                {course.completedLessons} of {course.totalLessons} lesson
                {course.totalLessons !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                style={{ width: `${course.percentComplete}%` }}
              />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
              Continue
              <ChevronRightIcon className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
