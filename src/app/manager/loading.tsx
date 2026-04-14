import { Skeleton, SkeletonCard, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function ManagerLoading() {
  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-5 w-28 mb-3" />
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#18181f]">
              {["Course", "Status", "Lessons", "Enrolled", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">
                  <Skeleton className="h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
