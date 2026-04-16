import { XpProgressBar } from "@/components/gamification/XpProgressBar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { GraduationCapIcon, CheckCircleIcon } from "@/components/icons";

interface StatsStripProps {
  xp: number;
  streak: number;
  completedCoursesCount: number;
  completedLessonsCount: number;
}

export function StatsStrip({
  xp,
  streak,
  completedCoursesCount,
  completedLessonsCount,
}: StatsStripProps) {
  const hasStats = xp > 0 || streak > 0 || completedCoursesCount > 0 || completedLessonsCount > 0;
  if (!hasStats) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Your Progress
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {/* XP / Level card — spans full width */}
        {xp > 0 && (
          <div className="col-span-2 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-4 animate-slide-up animate-init" style={{ animationDelay: "100ms" }}>
            <XpProgressBar xp={xp} />
          </div>
        )}

        {/* Streak */}
        {streak > 0 && (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-4 flex items-center justify-center animate-slide-up animate-init" style={{ animationDelay: "200ms" }}>
            <StreakBadge streak={streak} />
          </div>
        )}

        {/* Courses completed */}
        {completedCoursesCount > 0 && (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-4 animate-slide-up animate-init" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <GraduationCapIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {completedCoursesCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Course{completedCoursesCount !== 1 ? "s" : ""} completed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lessons completed */}
        {completedLessonsCount > 0 && (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-4 animate-slide-up animate-init" style={{ animationDelay: "400ms" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {completedLessonsCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Lesson{completedLessonsCount !== 1 ? "s" : ""} completed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
