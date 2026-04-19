"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, CheckCircleIcon, HamburgerIcon, CloseIcon, DocumentTextIcon, VideoIcon, QuizIcon, PaperclipIcon, LayoutGridIcon, ClockIcon } from "@/components/icons";
import type { LessonType } from "@/lib/types";
import type { DeadlineInfo } from "@/lib/deadlines";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

const LESSON_TYPE_ICON: Record<LessonType, React.FC<{ className?: string }>> = {
  text: DocumentTextIcon,
  video: VideoIcon,
  quiz: QuizIcon,
  document: PaperclipIcon,
  html: LayoutGridIcon,
};

export function CourseSidebar({
  modules,
  courseId,
  currentLessonId,
  courseTitle,
  completedLessonIds = new Set(),
  percentComplete = 0,
  deadlineInfoMap,
}: {
  modules: Module[];
  courseId: string;
  currentLessonId: string;
  courseTitle: string;
  completedLessonIds?: Set<string>;
  percentComplete?: number;
  deadlineInfoMap?: Record<string, DeadlineInfo>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  const sidebarContent = (
    <>
      {/* Back to course + title — course name takes precedence per §8.7.3 */}
      <div className="space-y-1 border-b border-border px-4 py-3">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1 text-xs text-foreground-subtle transition-colors hover:text-foreground"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Back to course
        </Link>
        <h2 className="line-clamp-2 font-display text-base font-semibold text-foreground">
          {courseTitle}
        </h2>
      </div>

      {/* Progress bar */}
      {totalLessons > 0 && (
        <div
          className="border-b border-border px-4 py-2.5"
          data-testid="progress-bar-container"
        >
          <div className="mb-1.5 flex justify-between text-xs text-foreground-muted">
            <span>Progress</span>
            <span data-testid="progress-percent">{percentComplete}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Course progress"
            aria-valuenow={percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
              style={{ width: `${percentComplete}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      )}

      {/* Module/Lesson navigation */}
      <nav className="py-2" aria-label="Course lessons">
        {modules.map((mod) => (
          <div key={mod.id} className="mb-1">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
                {mod.title}
              </span>
            </div>
            <div className="space-y-0.5">
              {mod.lessons.map((lesson) => {
                const isActive = lesson.id === currentLessonId;
                const isDone = completedLessonIds.has(lesson.id);
                return (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseId}/lessons/${lesson.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`relative mx-2 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary-subtle font-medium text-primary before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-primary"
                        : "text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {(() => { const LessonIcon = LESSON_TYPE_ICON[lesson.type]; return <LessonIcon className="h-4 w-4 flex-shrink-0 text-foreground-subtle" />; })()}
                    <span className="line-clamp-1 flex-1" title={lesson.title}>{lesson.title}</span>
                    {(() => {
                      const info = deadlineInfoMap?.[lesson.id];
                      if (!isDone && info && (info.status === "overdue" || info.status === "due-soon")) {
                        return (
                          <ClockIcon
                            className={`h-3.5 w-3.5 flex-shrink-0 ${
                              info.status === "overdue"
                                ? "text-danger"
                                : "text-warning"
                            }`}
                          />
                        );
                      }
                      return null;
                    })()}
                    {isDone && (
                      <CheckCircleIcon
                        className="h-4 w-4 flex-shrink-0 text-success"
                        aria-label="Completed"
                        data-testid={`completed-icon-${lesson.id}`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-5 z-30 flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 active:bg-primary/80 lg:hidden"
        aria-label="Open course navigation"
      >
        <HamburgerIcon className="h-5 w-5" />
        <span className="sr-only sm:not-sr-only">Lessons</span>
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Course navigation">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="animate-slide-in-left relative w-80 max-w-[85vw] flex-shrink-0 overflow-y-auto bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Course Navigation</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 transition-colors hover:bg-surface-muted"
                aria-label="Close course navigation"
              >
                <CloseIcon className="h-5 w-5 text-foreground-muted" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
