"use client";

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
}

export default function ProgressRing({
  completed,
  total,
  size = 100,
}: ProgressRingProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-[#2a2a35]"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-700 ease-out ${
            pct === 100
              ? "text-green-500"
              : "text-brand-500"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {pct}%
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-500">
          complete
        </span>
      </div>
    </div>
  );
}
