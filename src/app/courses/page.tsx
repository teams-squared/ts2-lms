import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { CourseCard } from "@/components/courses/CourseCard";
import { SearchBar } from "@/components/courses/SearchBar";
import { GraduationCapIcon } from "@/components/icons";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { q: searchQuery, status: statusFilter } = await searchParams;
  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";

  const statusMap: Record<string, Prisma.CourseWhereInput["status"]> = {
    draft: "DRAFT",
    published: "PUBLISHED",
    archived: "ARCHIVED",
  };

  // Build visibility filter
  let visibilityFilter: Prisma.CourseWhereInput;
  if (isPrivileged && statusFilter && statusMap[statusFilter]) {
    visibilityFilter = { status: statusMap[statusFilter] };
  } else if (!isPrivileged) {
    visibilityFilter = { status: "PUBLISHED" };
  } else {
    // privileged without filter — show published + own courses
    visibilityFilter = {
      OR: [{ status: "PUBLISHED" }, { createdById: session.user?.id }],
    };
  }

  // Build search filter
  let searchFilter: Prisma.CourseWhereInput = {};
  if (searchQuery?.trim()) {
    const q = searchQuery.trim();
    searchFilter = {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const where: Prisma.CourseWhereInput =
    searchQuery?.trim()
      ? { AND: [visibilityFilter, searchFilter] }
      : visibilityFilter;

  const courses = await prisma.course.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 flex items-center gap-2">
          <GraduationCapIcon className="w-6 h-6" />
          Course Catalog
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Browse available courses
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense fallback={null}>
          <SearchBar initialQuery={searchQuery ?? ""} />
        </Suspense>

        {isPrivileged && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
            {["all", "published", "draft", "archived"].map((s) => {
              const isActive = s === "all" ? !statusFilter : statusFilter === s;
              const href =
                s === "all"
                  ? `/courses${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`
                  : `/courses?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ""}status=${s}`;
              return (
                <a
                  key={s}
                  href={href}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                    isActive
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                      : "border-gray-200 dark:border-[#3a3a48] text-gray-500 dark:text-gray-400 hover:border-indigo-400"
                  }`}
                >
                  {s}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {searchQuery && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {courses.length} result{courses.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          {searchQuery ? `No courses found for "${searchQuery}".` : "No courses available yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              title={course.title}
              description={course.description}
              status={prismaStatusToApp(course.status)}
              thumbnail={course.thumbnail}
              createdBy={course.createdBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
