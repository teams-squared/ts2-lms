import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { checkCourseEligibility } from "@/lib/course-eligibility";
import { getNodeTree, getDescendantCourseIds, countCoursesInSubtree } from "@/lib/courseNodes";
import { CourseCard } from "@/components/courses/CourseCard";
import { SearchBar } from "@/components/courses/SearchBar";
import { CatalogSidebar } from "@/components/courses/CatalogSidebar";
import { GraduationCapIcon, BookOpenIcon, ChevronRightIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/types";
import type { SidebarNode } from "@/components/courses/CatalogSidebar";
import type { NodeWithChildren } from "@/lib/courseNodes";

export const dynamic = "force-dynamic";

/** Convert NodeWithChildren to SidebarNode (with recursive course counts) */
function toSidebarNode(node: NodeWithChildren): SidebarNode {
  return {
    id: node.id,
    name: node.name,
    courseCount: countCoursesInSubtree(node),
    children: node.children.map(toSidebarNode),
  };
}

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tab?: string; node?: string; category?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { q: searchQuery, status: statusFilter, tab, node: nodeFilter } = await searchParams;
  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";
  const activeTab = isPrivileged && tab !== "my" ? "all" : "my";
  const userId = session.user?.id;

  // Fetch node tree for sidebar (only needed for "all" tab, but light query)
  const nodeTree = await getNodeTree({ publishedOnly: true });
  const sidebarNodes = nodeTree.map(toSidebarNode);

  // ─── My Courses tab ────────────────────────────────────────────────────────
  type CourseWithMeta = {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    status: string;
    createdBy: { name: string | null; email: string };
    progressPercent?: number;
    completedLessons?: number;
    totalLessons?: number;
  };

  const myCourses: CourseWithMeta[] = await (async () => {
    if (activeTab !== "my" || !userId) return [];

    const enrollments = await prisma.enrollment.findMany({
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
    });

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
          progressPercent: total > 0 ? Math.round((completed / total) * 100) : undefined,
          completedLessons: total > 0 ? completed : undefined,
          totalLessons: total > 0 ? total : undefined,
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

  // Node-based filtering: get all descendant course IDs
  let nodeWhere: Prisma.CourseWhereInput = {};
  if (nodeFilter) {
    const descendantIds = getDescendantCourseIds(nodeTree, nodeFilter);
    if (descendantIds.length > 0) {
      nodeWhere = { id: { in: descendantIds } };
    } else {
      // Node exists but has no courses — show nothing
      nodeWhere = { id: { equals: "___none___" } };
    }
  }

  const filters: Prisma.CourseWhereInput[] = [visibilityFilter];
  if (searchQuery?.trim()) filters.push(searchFilter);
  if (nodeFilter) filters.push(nodeWhere);

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">

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

      {/* All Courses tab content — with sidebar layout */}
      {activeTab === "all" && (
        <div className="flex gap-6">
          {/* Sidebar */}
          {sidebarNodes.length > 0 && (
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-[4.5rem] rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                  Categories
                </p>
                <Suspense fallback={null}>
                  <CatalogSidebar nodes={sidebarNodes} activeNodeId={nodeFilter ?? null} />
                </Suspense>
              </div>
            </aside>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
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
                        ? `/courses${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}${nodeFilter ? `${searchQuery ? "&" : "?"}node=${nodeFilter}` : ""}`
                        : `/courses?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ""}status=${s}${nodeFilter ? `&node=${nodeFilter}` : ""}`;
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

            {/* Mobile node filter (pills for small screens) */}
            {sidebarNodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 lg:hidden">
                <span className="text-xs text-gray-500 dark:text-gray-400">Category:</span>
                <a
                  href={`/courses${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}${statusFilter ? `${searchQuery ? "&" : "?"}status=${statusFilter}` : ""}`}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    !nodeFilter
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                      : "border-gray-200 dark:border-[#3a3a48] text-gray-500 dark:text-gray-400 hover:border-brand-400"
                  }`}
                >
                  All
                </a>
                {sidebarNodes.map((n) => (
                  <a
                    key={n.id}
                    href={`/courses?node=${n.id}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      nodeFilter === n.id
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                        : "border-gray-200 dark:border-[#3a3a48] text-gray-500 dark:text-gray-400 hover:border-brand-400"
                    }`}
                  >
                    {n.name}
                  </a>
                ))}
              </div>
            )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
          </div>
        </div>
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
                  ? "You haven\u2019t been enrolled in any courses yet."
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
                <CourseCard
                  key={course.id}
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
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
