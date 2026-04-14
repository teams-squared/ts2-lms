"use client";

import Link from "next/link";
import { ChevronLeftIcon, CheckCircleIcon } from "@/components/icons";
import type { LessonType } from "@/lib/types";

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

const LESSON_TYPE_ICON: Record<LessonType, string> = {
  text: "📄",
  video: "🎬",
  quiz: "❓",
  document: "📎",
};

export function CourseSidebar({
  modules,
  courseId,
  currentLessonId,
  courseTitle,
  completedLessonIds = new Set(),
  percentComplete = 0,
}: {
  modules: Module[];
  courseId: string;
  currentLessonId: string;
  courseTitle: string;
  completedLessonIds?: Set<string>;
  percentComplete?: number;
}) {
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  return (
    <aside className="w-72 flex-shrink-0 border-r border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-y-auto">
      {/* Back to course */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#26262e]">
        <Link
          href={`/courses/${courseId}`}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
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
      <nav className="py-2">
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
                    className={`flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
                    }`}
                  >
                    <span className="text-xs flex-shrink-0">
                      {LESSON_TYPE_ICON[lesson.type]}
                    </span>
                    <span className="line-clamp-1 flex-1">{lesson.title}</span>
                    {isDone && (
                      <CheckCircleIcon
                        className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500"
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
    </aside>
  );
}
