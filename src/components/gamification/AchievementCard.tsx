"use client";

interface AchievementCardProps {
  icon: string;
  title: string;
  description: string;
  unlockedAt?: string | null;
}

export function AchievementCard({ icon, title, description, unlockedAt }: AchievementCardProps) {
  const isLocked = !unlockedAt;

  return (
    <div
      className={`relative p-4 rounded-xl border transition-shadow ${
        isLocked
          ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50"
          : "border-brand-200 dark:border-brand-800/40 bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated"
      }`}
    >
      <div className="text-2xl mb-2" role="img" aria-label={title}>
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
        {title}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      {unlockedAt && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          Unlocked {new Date(unlockedAt).toLocaleDateString()}
        </p>
      )}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg text-gray-400 dark:text-gray-500">🔒</span>
        </div>
      )}
    </div>
  );
}
