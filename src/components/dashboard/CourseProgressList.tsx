"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  GraduationCapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

/** Horizontally scrollable course card row with side buttons and edge fade. */
function ScrollableRow({ courses }: { courses: CourseItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      // Container has horizontal padding; treat values near zero as "at start".
      setCanScrollLeft(el.scrollLeft > 24);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 24);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [courses.length]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.8);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const edgeFade = {
    maskImage:
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={edgeFade}
      >
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
              className="group relative flex flex-col w-56 h-56 flex-shrink-0 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-400/50 dark:hover:border-brand-500/50 p-4 pt-5 transition-all animate-slide-up animate-init hover-lift overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Top accent strip in category color */}
              <div
                aria-hidden
                className="absolute top-0 inset-x-0 h-1"
                style={{ background: accentColor }}
              />

              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: iconBgColor }}
                >
                  <CategoryIcon
                    className="w-5 h-5"
                    style={{ color: "var(--icon-fg)" }}
                  />
                </div>
                {isAlmostDone && (
                  <span
                    className="flex-shrink-0 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 animate-glow whitespace-nowrap"
                    title="You're almost done!"
                  >
                    Almost
                  </span>
                )}
              </div>

              <h3 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-3 leading-snug">
                {course.courseTitle}
              </h3>

              <div className="mt-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 relative h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all duration-700"
                      style={{ width: `${course.percentComplete}%` }}
                    />
                    {isInProgress && (
                      <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer pointer-events-none" />
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
              </div>
            </Link>
          );
        })}
      </div>

      {/* Left scroll button */}
      <button
        type="button"
        onClick={() => scrollBy("left")}
        aria-label="Scroll courses left"
        disabled={!canScrollLeft}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-[#2e2e3a] shadow-card hover:shadow-card-hover text-gray-700 dark:text-gray-200 transition-all ${
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronLeftIcon className="w-4 h-4 mx-auto" />
      </button>

      {/* Right scroll button */}
      <button
        type="button"
        onClick={() => scrollBy("right")}
        aria-label="Scroll courses right"
        disabled={!canScrollRight}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-[#2e2e3a] shadow-card hover:shadow-card-hover text-gray-700 dark:text-gray-200 transition-all ${
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronRightIcon className="w-4 h-4 mx-auto" />
      </button>
    </div>
  );
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

  const completedBadge =
    completedCount > 0 ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <GraduationCapIcon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
        {completedCount} completed
      </span>
    ) : null;

  // No in-progress courses but completed some (or has enrollments that are all done)
  if (courses.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Your courses
          </h2>
          {completedBadge}
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
        {completedBadge}
      </div>
      <ScrollableRow courses={courses} />
    </section>
  );
}
