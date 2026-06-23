import { Skeleton, SkeletonListItem } from "@/components/ui/Skeleton";

export default function AdminClearanceLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-card p-5 divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  );
}
