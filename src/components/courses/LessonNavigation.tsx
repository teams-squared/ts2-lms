import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface Lesson {
  id: string;
  title: string;
}

interface Module {
  lessons: Lesson[];
}

interface LessonNavigationProps {
  courseId: string;
  currentLessonId: string;
  modules: Module[];
}

/**
 * Renders previous / next lesson navigation cards at the bottom of lesson content.
 * Returns null when the lesson is both first and last (single-lesson course).
 */
export function LessonNavigation({
  courseId,
  currentLessonId,
  modules,
}: LessonNavigationProps) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-[#2e2e3a] flex items-stretch gap-3">
      {prev ? (
        <Link
          href={`/courses/${courseId}/lessons/${prev.id}`}
          className="group flex items-center gap-3 flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] px-4 py-3 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all"
        >
          <ChevronLeftIcon className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
          <div className="min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Previous</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
              {prev.title}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <Link
          href={`/courses/${courseId}/lessons/${next.id}`}
          className="group flex items-center gap-3 flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] px-4 py-3 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all justify-end text-right"
        >
          <div className="min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Next</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
              {next.title}
            </p>
          </div>
          <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
