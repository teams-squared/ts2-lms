import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function CourseDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Thumbnail skeleton */}
      <Skeleton className="aspect-video rounded-lg mb-6" />

      {/* Status badge */}
      <Skeleton className="h-5 w-20 rounded-full mb-3" />

      {/* Title */}
      <Skeleton className="h-8 w-3/4 mb-3" />

      {/* Description */}
      <SkeletonText lines={2} className="mb-6" />

      {/* Author */}
      <div className="flex items-center gap-3 pt-4 border-t border-border mb-8">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-4 w-28 mb-1" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Course content skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
