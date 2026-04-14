import { Skeleton, SkeletonCard, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div>
      {/* Overview stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Course metrics table */}
      <div className="mb-8">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#18181f]">
                {["Course", "Enrollments", "Completion", "Avg Score", "Lessons"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#18181f]">
                {["User", "XP", "Streak", "Enrolled", "Lessons"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">
                    <Skeleton className="h-4 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
