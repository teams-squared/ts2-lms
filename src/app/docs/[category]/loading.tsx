function SidebarSkeleton() {
  return (
    <aside className="w-56 flex-shrink-0 hidden md:block">
      <div className="sticky top-16 space-y-4 pr-4">
        <div>
          <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function DocListItemSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-200/60 bg-white shadow-card">
      <div className="w-4 h-4 rounded bg-gray-200 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-1.5" />
        <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
        <div className="flex gap-3">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  );
}

export default function CategoryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-4 bg-gray-200 rounded w-10" />
        <div className="h-3 bg-gray-200 rounded w-3" />
        <div className="h-4 bg-gray-200 rounded w-8" />
        <div className="h-3 bg-gray-200 rounded w-3" />
        <div className="h-4 bg-gray-200 rounded w-28" />
      </div>

      <div className="flex gap-8">
        <SidebarSkeleton />
        <div className="flex-1 min-w-0">
          <div className="h-7 bg-gray-200 rounded w-48 mb-1.5" />
          <div className="h-4 bg-gray-200 rounded w-80 mb-5" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <DocListItemSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
