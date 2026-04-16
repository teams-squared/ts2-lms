import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

interface HeroNextStepProps {
  course: {
    courseTitle: string;
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
    continueUrl: string;
  } | null;
}

export function HeroNextStep({ course }: HeroNextStepProps) {
  if (!course) return null;

  const { courseTitle, completedLessons, totalLessons, percentComplete, continueUrl } = course;
  // conic-gradient angle: percentage of 360deg
  const angle = Math.round(percentComplete * 3.6);

  return (
    <Link
      href={continueUrl}
      className="group block animate-scale-in animate-init"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 dark:from-brand-800 dark:via-brand-900 dark:to-brand-950 shadow-elevated p-6 sm:p-8 transition-all hover:shadow-[0_12px_40px_rgba(68,0,255,.25)]">
        {/* Decorative glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-300/10 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Text content */}
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-200 dark:text-brand-300">
              Pick up where you left off
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight line-clamp-2 group-hover:text-brand-100 transition-colors">
              {courseTitle}
            </h2>
            <p className="text-sm text-brand-200 dark:text-brand-300">
              {completedLessons} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} completed
            </p>
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-gray-100 text-brand-700 font-semibold text-sm shadow-lg group-hover:bg-brand-50 transition-colors">
              Continue Learning
              <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          {/* Circular progress ring */}
          <div className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 relative self-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              {/* Background ring */}
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="10"
              />
              {/* Progress ring */}
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(angle / 360) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                className="drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                {percentComplete}
              </span>
              <span className="text-xs text-brand-200 font-medium -mt-0.5">% done</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
