import Link from "next/link";
import { CheckCircleIcon } from "@/components/icons";
import { formatActivityTime } from "@/lib/format";

interface ActivityItem {
  id: string;
  completedAt: Date;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Recent Activity
      </h2>
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <ul className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
          {items.slice(0, 3).map((item) => (
            <li key={item.id}>
              <Link
                href={`/courses/${item.courseId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {item.lessonTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.courseTitle}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {formatActivityTime(item.completedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
