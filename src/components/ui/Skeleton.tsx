interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-[#2e2e3a] ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-5 ${className}`}
      aria-hidden="true"
    >
      <Skeleton className="h-5 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function SkeletonCourseCard() {
  return (
    <div
      className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden"
      aria-hidden="true"
    >
      <Skeleton className="aspect-video rounded-none" />
      <div className="p-5">
        <Skeleton className="h-4 w-16 mb-3 rounded-full" />
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className={`h-4 ${i === 0 ? "w-32" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}
