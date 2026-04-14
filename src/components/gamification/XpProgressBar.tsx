"use client";

import { calculateLevel } from "@/lib/xp";

interface XpProgressBarProps {
  xp: number;
}

export function XpProgressBar({ xp }: XpProgressBarProps) {
  const { level, currentXp, nextLevelXp } = calculateLevel(xp);
  const progressPercent = Math.min((currentXp / nextLevelXp) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-brand-600 dark:text-brand-400">
          Level {level}
        </span>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums">
          {currentXp} / {nextLevelXp} XP
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
        {xp.toLocaleString()} XP total
      </p>
    </div>
  );
}
