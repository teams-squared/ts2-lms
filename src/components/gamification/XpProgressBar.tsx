"use client";

import { calculateLevel } from "@/lib/levels";

interface XpProgressBarProps {
  xp: number;
}

export function XpProgressBar({ xp }: XpProgressBarProps) {
  const { level, currentXp, nextLevelXp } = calculateLevel(xp);
  const progressPercent = Math.min((currentXp / nextLevelXp) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">
          Level {level}
        </span>
        <span className="text-foreground-muted tabular-nums">
          {currentXp} / {nextLevelXp} XP
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-label={`Level ${level} XP progress`}
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-foreground-subtle tabular-nums">
        {xp.toLocaleString()} XP total
      </p>
    </div>
  );
}
