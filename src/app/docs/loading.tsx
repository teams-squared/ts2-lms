function CategoryCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200/60 bg-white shadow-card">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg bg-gray-200" />
        <div className="w-4 h-4 rounded bg-gray-200" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1.5" />
      <div className="h-3 bg-gray-200 rounded w-full mb-1" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
      <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-3/5" />
        <div className="h-3 bg-gray-200 rounded w-2/4" />
      </div>
    </div>
  );
}

export default function DocsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-64 mb-4" />
        <div className="h-9 bg-gray-200 rounded-lg max-w-xl" />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CategoryCardSkeleton />
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1].map((i) => <CategoryCardSkeleton key={i} />)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CategoryCardSkeleton />
        </div>
      </div>
    </div>
  );
}
