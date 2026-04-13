"use client";

interface ProgressBarProps {
  completed: number;
  total: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function ProgressBar({
  completed,
  total,
  showLabel = true,
  size = "sm",
}: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barHeight = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 dark:text-gray-500">
            {completed}/{total} completed
          </span>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
            {pct}%
          </span>
        </div>
      )}
      <div
        className={`w-full ${barHeight} rounded-full bg-gray-100 dark:bg-[#26262e] overflow-hidden`}
      >
        <div
          className={`${barHeight} rounded-full transition-all duration-500 ease-out ${
            pct === 100
              ? "bg-green-500 dark:bg-green-500"
              : "bg-brand-500 dark:bg-brand-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
