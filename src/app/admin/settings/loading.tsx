import { Skeleton, SkeletonFormField } from "@/components/ui/Skeleton";

export default function AdminSettingsLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="rounded-lg border border-border bg-card p-5 space-y-5 max-w-2xl">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonFormField key={i} />
        ))}
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}
