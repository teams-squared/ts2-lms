function SidebarSkeleton() {
  return (
    <aside className="w-56 flex-shrink-0 hidden md:block">
      <div className="sticky top-16 space-y-4 pr-4">
        <div>
          <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-20 mb-2" />
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 bg-gray-200 dark:bg-[#26262e] rounded-lg" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-20 mb-2" />
          <div className="space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 bg-gray-200 dark:bg-[#26262e] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function DocLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-10" />
        <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-3" />
        <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-8" />
        <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-3" />
        <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-28" />
        <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-3" />
        <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-36" />
      </div>

      <div className="flex gap-8">
        <SidebarSkeleton />

        <article className="flex-1 min-w-0">
          <div className="mb-6 pb-4 border-b border-gray-100 dark:border-[#26262e]">
            <div className="h-7 bg-gray-200 dark:bg-[#26262e] rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-full mb-1" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-3/4 mb-3" />
            <div className="flex items-center gap-3">
              <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-20" />
              <div className="h-3 bg-gray-200 dark:bg-[#26262e] rounded w-28" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-11/12" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-4/5" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-3/4" />
            <div className="h-5 bg-gray-200 dark:bg-[#26262e] rounded w-1/3 mt-6 mb-1" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-[#26262e] rounded w-2/3" />
          </div>
        </article>
      </div>
    </div>
  );
}
