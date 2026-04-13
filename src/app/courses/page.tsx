import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
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
  searchParams: Promise<{ q?: string; status?: string; tab?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { q: searchQuery, status: statusFilter, tab } = await searchParams;
  const activeTab = tab === "my" ? "my" : "all";
  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";
  const userId = session.user?.id;

  // ─── My Courses tab ────────────────────────────────────────────────────────
  type CourseWithMeta = {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    status: string;
    createdBy: { name: string | null; email: string };
    source: "enrolled" | "assigned";
  };

  const myCourses: CourseWithMeta[] = await (async () => {
    if (activeTab !== "my" || !userId) return [];

    const [enrollments, assignments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: { createdBy: { select: { name: true, email: true } } },
          },
        },
      }),
      prisma.assignment.findMany({
        where: { userId },
        include: {
          course: {
            include: { createdBy: { select: { name: true, email: true } } },
          },
        },
      }),
    ]);

    const result: CourseWithMeta[] = [];
    const seen = new Set<string>();
    for (const e of enrollments) {
      if (!seen.has(e.courseId)) {
        seen.add(e.courseId);
        result.push({
          id: e.course.id,
          title: e.course.title,
          description: e.course.description,
          thumbnail: e.course.thumbnail,
          status: prismaStatusToApp(e.course.status),
          createdBy: e.course.createdBy,
          source: "enrolled",
        });
      }
    }
    for (const a of assignments) {
      if (!seen.has(a.courseId)) {
        seen.add(a.courseId);
        result.push({
          id: a.course.id,
          title: a.course.title,
          description: a.course.description,
          thumbnail: a.course.thumbnail,
          status: prismaStatusToApp(a.course.status),
          createdBy: a.course.createdBy,
          source: "assigned",
        });
      }
    }
    return result;
  })();

  // ─── All Courses tab ───────────────────────────────────────────────────────
  const statusMap: Record<string, Prisma.CourseWhereInput["status"]> = {
    draft: "DRAFT",
    published: "PUBLISHED",
    archived: "ARCHIVED",
  };

  let visibilityFilter: Prisma.CourseWhereInput;
  if (isPrivileged && statusFilter && statusMap[statusFilter]) {
    visibilityFilter = { status: statusMap[statusFilter] };
  } else if (!isPrivileged) {
    visibilityFilter = { status: "PUBLISHED" };
  } else {
    visibilityFilter = {
      OR: [{ status: "PUBLISHED" }, { createdById: userId }],
    };
  }

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

  const allCourses =
    activeTab === "all"
      ? await prisma.course.findMany({
          where,
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 flex items-center gap-2">
          <GraduationCapIcon className="w-6 h-6" />
          Courses
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Browse and track your learning
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-[#2e2e3a]">
        <Link
          href="/courses?tab=my"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "my"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          My Courses
        </Link>
        <Link
          href="/courses"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          All Courses
        </Link>
      </div>

      {/* All Courses tab content */}
      {activeTab === "all" && (
        <>
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
              {allCourses.length} result{allCourses.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {allCourses.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? `No courses found for "${searchQuery}".`
                : "No courses available yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCourses.map((course) => (
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
        </>
      )}

      {/* My Courses tab content */}
      {activeTab === "my" && (
        <>
          {myCourses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                You are not enrolled in or assigned to any courses yet.
              </p>
              <Link
                href="/courses"
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Browse all courses →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCourses.map((course) => (
                <div key={course.id} className="relative">
                  {course.source === "assigned" && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                        Assigned
                      </span>
                    </div>
                  )}
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    status={course.status as import("@/lib/types").CourseStatus}
                    thumbnail={course.thumbnail}
                    createdBy={course.createdBy}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
