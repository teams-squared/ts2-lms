"use client";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-subtle border border-warning/60">
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full bg-warning"
      />
      <span className="text-sm font-semibold text-warning tabular-nums">
        {streak}-day streak
      </span>
    </div>
  );
}
