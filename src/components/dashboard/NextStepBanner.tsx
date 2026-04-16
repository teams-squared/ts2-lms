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

function getNudge(percent: number, isOverdue: boolean): string {
  if (isOverdue) return "This lesson is overdue — let's get it done.";
  if (percent === 0)  return "Kick things off and earn your first XP.";
  if (percent < 25)   return "You've started strong — keep the momentum going.";
  if (percent < 50)   return "You're getting there — one step at a time.";
  if (percent < 75)   return `You're ${percent}% of the way — more than halfway!`;
  if (percent < 100)  return "Almost there — push through to finish!";
  return "Course complete — amazing work!";
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
  const nudge = getNudge(percentComplete, isOverdue);
  const nextLessonNumber = completedLessons + 1;

  return (
    <section className="animate-fade-in animate-init">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        Pick up where you left off
      </p>
      <Link
        href={continueUrl}
        className={`group relative block rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition-all p-5 sm:p-6 hover-lift ${
          isOverdue
            ? "border-l-4 border-l-red-500 bg-white dark:bg-[#1c1c24] border-y border-r border-y-gray-200/80 border-r-gray-200/80 dark:border-y-[#2e2e3a] dark:border-r-[#2e2e3a]"
            : "border border-brand-200/60 dark:border-brand-900/50 bg-gradient-to-br from-brand-50 via-white to-brand-100/60 dark:from-[#1a1230] dark:via-[#1c1c24] dark:to-[#2a1450]"
        }`}
      >
        {/* Decorative accent blur (only on non-overdue) */}
        {!isOverdue && (
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-400/20 dark:bg-brand-500/20 blur-3xl pointer-events-none transition-opacity group-hover:opacity-60"
          />
        )}

        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isOverdue && (
                <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse-attention" />
              )}
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                {courseTitle}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400 mr-1.5">
                Lesson {nextLessonNumber}/{totalLessons}
              </span>
              {lessonTitle}
            </p>
            <p className={`text-xs mb-3 ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
              {nudge}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative h-2 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 via-fuchsia-500 to-brand-400 rounded-full transition-all duration-700"
                  style={{ width: `${percentComplete}%` }}
                />
                {/* Shimmer overlay while in progress */}
                {percentComplete > 0 && percentComplete < 100 && (
                  <div
                    className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer pointer-events-none"
                  />
                )}
              </div>
              <span className="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                {completedLessons}/{totalLessons}
              </span>
            </div>
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 transition-all group-hover:scale-[1.03]">
            Continue
            <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </section>
  );
}
