import { calculateLevel } from "@/lib/levels";

interface WelcomeBarProps {
  firstName: string;
  xp: number;
  streak: number;
}

export function WelcomeBar({ firstName, xp, streak }: WelcomeBarProps) {
  const { level, currentXp, nextLevelXp } = calculateLevel(xp);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-2">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Welcome back, {firstName}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              Lv. {level}
            </span>
            <span className="tabular-nums">
              {currentXp}/{nextLevelXp} XP
            </span>
          </span>
          {streak > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">🔥</span>
                <span className="tabular-nums">
                  {streak}-day streak
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
