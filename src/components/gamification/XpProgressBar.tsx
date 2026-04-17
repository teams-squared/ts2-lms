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
      <div className="h-3.5 rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 shadow-sm shadow-brand-400/30 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-foreground-subtle tabular-nums">
        {xp.toLocaleString()} XP total
      </p>
    </div>
  );
}
