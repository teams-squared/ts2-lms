import { Skeleton, SkeletonListItem } from "@/components/ui/Skeleton";

export default function AdminNodesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-card p-5 divide-y divide-border">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  );
}
