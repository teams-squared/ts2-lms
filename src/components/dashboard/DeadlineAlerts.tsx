"use client";

import { useState } from "react";
import Link from "next/link";
import { ClockIcon, AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import type { DeadlineStatus } from "@/lib/deadlines";

interface DeadlineItem {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  status: DeadlineStatus;
  relativeText: string;
}

interface DeadlineAlertsProps {
  deadlines: DeadlineItem[];
}

const statusConfig: Record<string, {
  borderClass: string;
  bgClass: string;
  badgeClass: string;
}> = {
  overdue: {
    borderClass: "border-l-4 border-l-red-500",
    bgClass: "bg-red-50/50 dark:bg-red-950/20",
    badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  },
  "due-soon": {
    borderClass: "border-l-4 border-l-amber-500",
    bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
    badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
  upcoming: {
    borderClass: "",
    bgClass: "",
    badgeClass: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  },
};

function DeadlineRow({ item }: { item: DeadlineItem }) {
  const config = statusConfig[item.status] || statusConfig.upcoming;
  return (
    <Link
      href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors ${config.borderClass} ${config.bgClass}`}
    >
      <div className="flex-shrink-0">
        {item.status === "overdue" ? (
          <AlertTriangleIcon className="w-4 h-4 text-red-500 animate-pulse-attention" />
        ) : (
          <ClockIcon
            className={`w-4 h-4 ${
              item.status === "due-soon"
                ? "text-amber-500"
                : "text-gray-400 dark:text-gray-500"
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {item.lessonTitle}
        </p>
        <span className="text-xs text-gray-400 dark:text-gray-600 flex-shrink-0">·</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {item.courseTitle}
        </p>
      </div>
      <span
        className={`flex-shrink-0 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}
      >
        {item.relativeText}
      </span>
    </Link>
  );
}

export function DeadlineAlerts({ deadlines }: DeadlineAlertsProps) {
  const [showUpcoming, setShowUpcoming] = useState(false);

  const urgent = deadlines.filter((d) => d.status === "overdue" || d.status === "due-soon");
  const upcoming = deadlines.filter((d) => d.status === "upcoming");

  // If nothing urgent, render nothing
  if (urgent.length === 0) return null;

  return (
    <section className="animate-fade-in animate-init" style={{ animationDelay: "100ms" }}>
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
        <AlertTriangleIcon className="w-3.5 h-3.5" />
        Needs your attention
      </h2>
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-[#26262e]">
          {urgent.map((item) => (
            <DeadlineRow key={item.lessonId} item={item} />
          ))}
          {showUpcoming &&
            upcoming.map((item) => (
              <DeadlineRow key={item.lessonId} item={item} />
            ))}
        </div>
        {upcoming.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUpcoming((v) => !v)}
            className="w-full px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors border-t border-gray-100 dark:border-[#26262e] inline-flex items-center justify-center gap-1.5"
          >
            {showUpcoming ? (
              <>
                Hide upcoming
                <ChevronUpIcon className="w-3 h-3" />
              </>
            ) : (
              <>
                {upcoming.length} more upcoming
                <ChevronDownIcon className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
