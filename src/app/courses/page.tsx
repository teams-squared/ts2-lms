import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { checkCourseEligibility } from "@/lib/course-eligibility";
import { CourseCard } from "@/components/courses/CourseCard";
import { SearchBar } from "@/components/courses/SearchBar";
import { GraduationCapIcon, BookOpenIcon, ChevronRightIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tab?: string; category?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { q: searchQuery, status: statusFilter, tab, category: categoryFilter } = await searchParams;
  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";
  // Non-privileged users only see their enrolled courses — no "All Courses" tab
  const activeTab = isPrivileged && tab !== "my" ? "all" : "my";
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
    progressPercent?: number;
    completedLessons?: number;
    totalLessons?: number;
  };

  const myCourses: CourseWithMeta[] = await (async () => {
    if (activeTab !== "my" || !userId) return [];

    const [enrollments, assignments] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              createdBy: { select: { name: true, email: true } },
              modules: {
                include: { lessons: { select: { id: true } } },
              },
            },
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

    // Compute progress for enrolled courses in a single batch query
    const allLessonIds = enrollments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );
    const completedRecords =
      allLessonIds.length > 0
        ? await prisma.lessonProgress.findMany({
            where: { userId: userId!, lessonId: { in: allLessonIds }, completedAt: { not: null } },
            select: { lessonId: true },
          })
        : [];
    const completedSet = new Set(completedRecords.map((p) => p.lessonId));

    const result: CourseWithMeta[] = [];
    const seen = new Set<string>();
    for (const e of enrollments) {
      if (!seen.has(e.courseId)) {
        seen.add(e.courseId);
        const courseLessons = e.course.modules.flatMap((m) => m.lessons);
        const total = courseLessons.length;
        const completed = courseLessons.filter((l) => completedSet.has(l.id)).length;
        result.push({
          id: e.course.id,
          title: e.course.title,
          description: e.course.description,
          thumbnail: e.course.thumbnail,
          status: prismaStatusToApp(e.course.status),
          createdBy: e.course.createdBy,
          source: "enrolled",
          progressPercent: total > 0 ? Math.round((completed / total) * 100) : undefined,
          completedLessons: total > 0 ? completed : undefined,
          totalLessons: total > 0 ? total : undefined,
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

  let categoryWhere: Prisma.CourseWhereInput = {};
  if (categoryFilter && categoryFilter !== "all") {
    categoryWhere = { category: categoryFilter };
  }

  const filters: Prisma.CourseWhereInput[] = [visibilityFilter];
  if (searchQuery?.trim()) filters.push(searchFilter);
  if (categoryFilter && categoryFilter !== "all") filters.push(categoryWhere);

  const where: Prisma.CourseWhereInput =
    filters.length > 1 ? { AND: filters } : filters[0];

  const allCourses =
    activeTab === "all"
      ? await prisma.course.findMany({
          where,
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // Check eligibility for each course
  const eligibilityMap = new Map<string, { locked: boolean; lockReason?: string }>();
  if (activeTab === "all" && userId) {
    const results = await Promise.all(
      allCourses.map((c) => checkCourseEligibility(userId, (session.user?.role ?? "employee") as Role, c.id)),
    );
    allCourses.forEach((c, i) => {
      const elig = results[i];
      if (!elig.eligible) {
        const parts: string[] = [];
        if (elig.missingPrerequisites.length > 0) {
          parts.push(`Complete: ${elig.missingPrerequisites.map((p) => p.title).join(", ")}`);
        }
        if (elig.missingClearance) {
          parts.push(`Requires ${elig.missingClearance.toUpperCase()} clearance`);
        }
        eligibilityMap.set(c.id, { locked: true, lockReason: parts.join(". ") });
      } else {
        eligibilityMap.set(c.id, { locked: false });
      }
    });
  }

  return (
    <div>
      <div className="bg-page-header-gradient">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Courses" }]} />
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

      {/* Tabs — only shown for admins/managers who have both views */}
      {isPrivileged && (
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-[#2e2e3a]">
          <Link
            href="/courses?tab=my"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "my"
                ? "border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            My Courses
          </Link>
          <Link
            href="/courses"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            All Courses
          </Link>
        </div>
      )}

      {/* All Courses tab content */}
      {activeTab === "all" && (
        <>
          {/* Category filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">Category:</span>
            {["all", "onboarding", "cybersecurity", "hr"].map((cat) => {
              const CATEGORY_LABELS: Record<string, string> = {
                all: "All",
                onboarding: "Onboarding",
                cybersecurity: "Cybersecurity",
                hr: "HR",
              };
              const isActive = cat === "all" ? !categoryFilter || categoryFilter === "all" : categoryFilter === cat;
              const base = "/courses";
              const qp = new URLSearchParams();
              if (searchQuery) qp.set("q", searchQuery);
              if (statusFilter) qp.set("status", statusFilter);
              if (cat !== "all") qp.set("category", cat);
              const href = qp.toString() ? `${base}?${qp.toString()}` : base;
              return (
                <a
                  key={cat}
                  href={href}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                      : "border-gray-200 dark:border-[#3a3a48] text-gray-500 dark:text-gray-400 hover:border-brand-400"
                  }`}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </a>
              );
            })}
          </div>

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
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                          : "border-gray-200 dark:border-[#3a3a48] text-gray-500 dark:text-gray-400 hover:border-brand-400"
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
            <div className="text-center py-20">
              <GraduationCapIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                {searchQuery ? "No courses found" : "No courses available yet"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {searchQuery
                  ? `We couldn\u2019t find any courses matching \u201c${searchQuery}\u201d. Try a different search term.`
                  : "New courses are being added regularly. Check back soon!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {allCourses.map((course) => {
                const elig = eligibilityMap.get(course.id);
                return (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    status={prismaStatusToApp(course.status)}
                    thumbnail={course.thumbnail}
                    createdBy={course.createdBy}
                    locked={elig?.locked}
                    lockReason={elig?.lockReason}
                    showStatus={isPrivileged}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My Courses tab content */}
      {activeTab === "my" && (
        <>
          {myCourses.length === 0 ? (
            <div className="text-center py-20">
              <BookOpenIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                No courses yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {isPrivileged
                  ? "You haven\u2019t enrolled in or been assigned any courses yet."
                  : "No courses have been assigned to you yet. Contact your administrator."}
              </p>
              {isPrivileged && (
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Browse all courses
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myCourses.map((course) => (
                <div key={course.id} className="relative">
                  {course.source === "assigned" && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
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
                    showStatus={isPrivileged}
                    progressPercent={course.progressPercent}
                    completedLessons={course.completedLessons}
                    totalLessons={course.totalLessons}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
