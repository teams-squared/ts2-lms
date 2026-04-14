import { Skeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Skeleton className="h-8 w-32 mb-6" />

      {/* Profile card */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="p-6 flex items-start gap-5 border-b border-gray-100 dark:border-[#2e2e3a]">
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-56 mb-2" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Progress section */}
      <div className="mt-8 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="p-6">
          <Skeleton className="h-5 w-24 mb-4" />
          <Skeleton className="h-3.5 w-full rounded-full mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
