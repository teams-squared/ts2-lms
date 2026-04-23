"use client";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-subtle border border-warning/60">
      <span className="text-base" role="img" aria-label="fire">
        🔥
      </span>
      <span className="text-sm font-semibold text-warning tabular-nums">
        {streak}-day streak
      </span>
    </div>
  );
}
