import Link from "next/link";
import { ClockIcon, AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";
import type { DeadlineStatus } from "@/lib/deadlines";

interface DeadlineItem {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  status: DeadlineStatus;
  relativeText: string;
}

interface DeadlinesPanelProps {
  deadlines: DeadlineItem[];
}

const statusConfig: Record<string, {
  borderClass: string;
  bgClass: string;
  badgeClass: string;
  icon: "alert" | "clock" | "default";
}> = {
  overdue: {
    borderClass: "border-l-4 border-l-red-500",
    bgClass: "bg-red-50/50 dark:bg-red-950/20",
    badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    icon: "alert",
  },
  "due-soon": {
    borderClass: "border-l-4 border-l-amber-500",
    bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
    badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    icon: "clock",
  },
  upcoming: {
    borderClass: "",
    bgClass: "",
    badgeClass: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    icon: "default",
  },
};

export function DeadlinesPanel({ deadlines }: DeadlinesPanelProps) {
  return (
    <section className="animate-fade-in animate-init" style={{ animationDelay: "200ms" }}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <ClockIcon className="w-4 h-4" />
        Deadlines
      </h2>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        {deadlines.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <CheckCircleIcon className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No upcoming deadlines
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {deadlines.map((item) => {
              const config = statusConfig[item.status] || statusConfig.upcoming;
              return (
                <Link
                  key={item.lessonId}
                  href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
                  className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors ${config.borderClass} ${config.bgClass}`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {item.status === "overdue" ? (
                        <div className="relative">
                          <AlertTriangleIcon className="w-4 h-4 text-red-500" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse-attention" />
                        </div>
                      ) : (
                        <ClockIcon className={`w-4 h-4 ${
                          item.status === "due-soon"
                            ? "text-amber-500"
                            : "text-gray-400 dark:text-gray-500"
                        }`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.lessonTitle}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.courseTitle}
                      </p>
                    </div>
                  </div>

                  {/* Deadline badge */}
                  <div className="mt-1.5 ml-6.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                      {item.relativeText}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
