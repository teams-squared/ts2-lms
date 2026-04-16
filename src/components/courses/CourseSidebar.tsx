"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, CheckCircleIcon, HamburgerIcon, CloseIcon, DocumentTextIcon, VideoIcon, QuizIcon, PaperclipIcon, ClockIcon } from "@/components/icons";
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
      {/* Back to course */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#26262e]">
        <Link
          href={`/courses/${courseId}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to course
        </Link>
        <h2 className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          {courseTitle}
        </h2>
      </div>

      {/* Progress bar */}
      {totalLessons > 0 && (
        <div
          className="px-4 py-2.5 border-b border-gray-100 dark:border-[#26262e]"
          data-testid="progress-bar-container"
        >
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>Progress</span>
            <span data-testid="progress-percent">{percentComplete}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-300"
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
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
                    className={`flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
                    }`}
                  >
                    {(() => { const LessonIcon = LESSON_TYPE_ICON[lesson.type]; return <LessonIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />; })()}
                    <span className="line-clamp-1 flex-1" title={lesson.title}>{lesson.title}</span>
                    {(() => {
                      const info = deadlineInfoMap?.[lesson.id];
                      if (!isDone && info && (info.status === "overdue" || info.status === "due-soon")) {
                        return (
                          <ClockIcon
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              info.status === "overdue"
                                ? "text-red-500 dark:text-red-400"
                                : "text-amber-500 dark:text-amber-400"
                            }`}
                          />
                        );
                      }
                      return null;
                    })()}
                    {isDone && (
                      <CheckCircleIcon
                        className="w-4 h-4 flex-shrink-0 text-emerald-500"
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
        className="lg:hidden fixed bottom-5 left-5 z-30 flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/25 text-sm font-medium hover:bg-brand-700 active:bg-brand-800 transition-colors"
        aria-label="Open course navigation"
      >
        <HamburgerIcon className="w-5 h-5" />
        <span className="sr-only sm:not-sr-only">Lessons</span>
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Course navigation">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-80 max-w-[85vw] flex-shrink-0 bg-white dark:bg-[#1c1c24] overflow-y-auto animate-slide-in-left">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#26262e]">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Course Navigation</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2e2e3a] transition-colors"
                aria-label="Close course navigation"
              >
                <CloseIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}
