import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="rounded-lg border border-border divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  );
}
