import Link from "next/link";
import { ChevronRightIcon, AlertTriangleIcon } from "@/components/icons";

interface NextStepBannerProps {
  courseTitle: string;
  lessonTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  continueUrl: string;
  isOverdue: boolean;
}

export function NextStepBanner({
  courseTitle,
  lessonTitle,
  completedLessons,
  totalLessons,
  percentComplete,
  continueUrl,
  isOverdue,
}: NextStepBannerProps) {
  return (
    <section className="animate-fade-in animate-init">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        Pick up where you left off
      </p>
      <Link
        href={continueUrl}
        className={`group block rounded-xl border bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated transition-all p-5 sm:p-6 ${
          isOverdue
            ? "border-l-4 border-l-red-500 border-y-gray-200/80 border-r-gray-200/80 dark:border-y-[#2e2e3a] dark:border-r-[#2e2e3a]"
            : "border-gray-200/80 dark:border-[#2e2e3a]"
        }`}
      >
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isOverdue && (
                <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                {courseTitle}
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-3">
              Next: {lessonTitle}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
              <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {completedLessons}/{totalLessons}
              </span>
            </div>
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors">
            Continue
            <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </section>
  );
}
