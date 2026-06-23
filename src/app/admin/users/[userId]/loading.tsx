import {
  Skeleton,
  SkeletonCard,
  SkeletonFormField,
} from "@/components/ui/Skeleton";

export default function AdminUserDetailLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-5 space-y-5 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonFormField key={i} />
        ))}
      </div>
    </div>
  );
}
