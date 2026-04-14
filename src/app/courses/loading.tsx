import { Skeleton, SkeletonCourseCard } from "@/components/ui/Skeleton";
import { GraduationCapIcon } from "@/components/icons";

export default function CoursesLoading() {
  return (
    <div>
      <div className="bg-page-header-gradient">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 flex items-center gap-2">
            <GraduationCapIcon className="w-6 h-6" />
            Courses
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse and track your learning
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {/* Tab skeleton */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-[#2e2e3a]">
          <Skeleton className="h-4 w-24 my-3" />
          <Skeleton className="h-4 w-24 my-3 ml-4" />
        </div>
        {/* Course card grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCourseCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
