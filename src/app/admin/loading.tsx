import { Skeleton, SkeletonCard, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Section cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <Skeleton className="w-5 h-5 mb-3" />
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div>
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-muted">
                {["User", "Role", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
