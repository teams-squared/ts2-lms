"use client";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40">
      <span className="text-base" role="img" aria-label="fire">
        🔥
      </span>
      <span className="text-sm font-semibold text-orange-700 dark:text-orange-400 tabular-nums">
        {streak}-day streak
      </span>
    </div>
  );
}
