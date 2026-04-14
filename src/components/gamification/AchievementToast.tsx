"use client";

import { useEffect, useState } from "react";

interface Achievement {
  key: string;
  title: string;
  icon: string;
}

interface AchievementToastProps {
  achievements: Achievement[];
  onDismiss?: () => void;
}

export function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (achievements.length === 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [achievements, onDismiss]);

  if (!visible || achievements.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 animate-slide-up">
      {achievements.map((a) => (
        <div
          key={a.key}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-600 dark:bg-brand-700 text-white shadow-elevated"
        >
          <span className="text-2xl" role="img" aria-label={a.title}>
            {a.icon}
          </span>
          <div>
            <p className="text-xs font-medium text-brand-100">Achievement Unlocked!</p>
            <p className="text-sm font-semibold">{a.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
