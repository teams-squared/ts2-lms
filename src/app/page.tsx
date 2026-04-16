import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Logo from "@/components/Logo";
import { RoleBadge } from "@/components/ui/Badge";
import {
  GraduationCapIcon,
  UsersIcon,
  ShieldIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  BookOpenIcon,
  ClockIcon,
} from "@/components/icons";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineStatus } from "@/lib/deadlines";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Returns a human-readable relative time string for a past date. */
function formatActivityTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function HomePage() {
  const session = await auth();

  // ── Logged-out landing page ────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f8] dark:bg-[#0f0f14]">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center mb-2">
            <Logo size={48} showText={false} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Teams Squared{" "}
              <span className="text-brand-600 dark:text-brand-400">LMS</span>
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400">
              Sign in to access your learning platform.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-lg shadow-brand-600/25 text-sm"
          >
            Sign in
          </Link>
        </div>
        <p className="absolute bottom-6 text-xs text-gray-400 dark:text-gray-600">
          &copy; {new Date().getFullYear()} Teams Squared
        </p>
      </div>
    );
  }

  // ── Logged-in dashboard ────────────────────────────────────────────────────
  const userId = session.user!.id!;
  const userRole = (session.user?.role as Role) || "employee";
  const firstName = session.user?.name?.split(" ")[0] || "there";

  // Fetch enrollments (with full course/module/lesson structure for progress computation),
  // recent lesson completions, and user stats — all in parallel.
  const [enrollments, recentProgress, userStats] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            modules: {
              orderBy: { order: "asc" },
              include: {
                lessons: {
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, deadlineDays: true },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: {
        lesson: {
          select: {
            title: true,
            module: {
              select: {
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    }),
    prisma.userStats.findUnique({ where: { userId } }),
  ]);

  // Compute per-enrollment progress in a single batch query
  const allEnrolledLessonIds = enrollments.flatMap((e) =>
    e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
  );

  const completedProgressRecords =
    allEnrolledLessonIds.length > 0
      ? await prisma.lessonProgress.findMany({
          where: {
            userId,
            lessonId: { in: allEnrolledLessonIds },
            completedAt: { not: null },
          },
          select: { lessonId: true },
        })
      : [];

  const completedIdSet = new Set(completedProgressRecords.map((p) => p.lessonId));

  // Compute upcoming deadlines across all enrollments
  const deadlineItems: {
    lessonId: string;
    lessonTitle: string;
    courseId: string;
    courseTitle: string;
    absoluteDeadline: Date;
    status: DeadlineStatus;
    relativeText: string;
  }[] = [];
  for (const e of enrollments) {
    for (const m of e.course.modules) {
      for (const l of m.lessons) {
        if (l.deadlineDays == null) continue;
        if (completedIdSet.has(l.id)) continue; // already done
        const deadline = computeDeadline(e.enrolledAt, l.deadlineDays);
        const status = getDeadlineStatus(e.enrolledAt, l.deadlineDays, null);
        if (status === "none" || status === "completed") continue;
        deadlineItems.push({
          lessonId: l.id,
          lessonTitle: l.title,
          courseId: e.course.id,
          courseTitle: e.course.title,
          absoluteDeadline: deadline,
          status,
          relativeText: formatDeadlineRelative(deadline),
        });
      }
    }
  }
  // Sort: overdue first, then due-soon, then upcoming — by deadline date
  const statusPriority: Record<string, number> = { overdue: 0, "due-soon": 1, upcoming: 2 };
  deadlineItems.sort(
    (a, b) =>
      (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3) ||
      a.absoluteDeadline.getTime() - b.absoluteDeadline.getTime(),
  );
  const topDeadlines = deadlineItems.slice(0, 5);

  const enrichedEnrollments = enrollments.map((e) => {
    const allLessons = e.course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;
    const completedLessons = allLessons.filter((l) => completedIdSet.has(l.id)).length;
    const percentComplete =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const isComplete = totalLessons > 0 && completedLessons === totalLessons;
    const firstIncompleteLessonId =
      allLessons.find((l) => !completedIdSet.has(l.id))?.id ?? allLessons[0]?.id;
    const continueUrl = firstIncompleteLessonId
      ? `/courses/${e.course.id}/lessons/${firstIncompleteLessonId}`
      : `/courses/${e.course.id}`;
    return { ...e, totalLessons, completedLessons, percentComplete, isComplete, continueUrl };
  });

  const inProgressCourses = enrichedEnrollments.filter((c) => !c.isComplete && c.totalLessons > 0);
  const completedCourses = enrichedEnrollments.filter((c) => c.isComplete);

  return (
    <div>
      {/* ── Welcome hero ───────────────────────────────────────────────────── */}
      <div className="bg-brand-gradient-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-2">
            Welcome back, {firstName}
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {session.user?.email}
            </p>
            <RoleBadge role={userRole} />
          </div>

          {/* Stats chips */}
          <div className="flex flex-wrap items-center gap-5">
            {userStats && userStats.xp > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span aria-hidden="true">⚡</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {userStats.xp.toLocaleString()}
                </span>
                <span className="text-gray-500 dark:text-gray-400">XP</span>
              </div>
            )}
            {userStats && userStats.streak > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span aria-hidden="true">🔥</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {userStats.streak}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  day streak
                </span>
              </div>
            )}
            {completedCourses.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span aria-hidden="true">🎓</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {completedCourses.length}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  course{completedCourses.length !== 1 ? "s" : ""} complete
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* ── Continue Learning ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Continue Learning
            </h2>
            {inProgressCourses.length > 4 && (
              <Link
                href="/courses?tab=my"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-0.5"
              >
                View all
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {inProgressCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#2e2e3a] p-8 text-center">
              <GraduationCapIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {enrichedEnrollments.length === 0
                  ? "No courses have been assigned to you yet"
                  : "All enrolled courses complete!"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {enrichedEnrollments.length === 0
                  ? (userRole === "admin"
                      ? "Browse the catalog to find courses."
                      : "Contact your administrator to get enrolled in courses.")
                  : "Great work! Check back for new courses."}
              </p>
              {userRole === "admin" && (
                <Link
                  href="/courses"
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Browse the catalog →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inProgressCourses.slice(0, 4).map((course) => (
                <Link
                  key={course.course.id}
                  href={course.continueUrl}
                  className="group block rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift p-5 transition-all"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2 mb-3">
                    {course.course.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    <span>
                      {course.completedLessons} of {course.totalLessons} lesson
                      {course.totalLessons !== 1 ? "s" : ""}
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {course.percentComplete}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                      style={{ width: `${course.percentComplete}%` }}
                    />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                    Continue
                    <ChevronRightIcon className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Upcoming Deadlines ─────────────────────────────────────────── */}
        {topDeadlines.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Upcoming Deadlines
            </h2>
            <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card divide-y divide-gray-100 dark:divide-[#26262e]">
              {topDeadlines.map((item) => (
                <Link
                  key={item.lessonId}
                  href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.lessonTitle}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.courseTitle}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 ml-3 text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.status === "overdue"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : item.status === "due-soon"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {item.relativeText}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        {recentProgress.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Recent Activity
            </h2>
            <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
                {recentProgress.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/courses/${p.lesson.module.course.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          {p.lesson.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {p.lesson.module.course.title}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {formatActivityTime(p.completedAt!)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Quick links ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={userRole === "admin" ? "/courses" : "/courses?tab=my"}
              className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
            >
              <GraduationCapIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                {userRole === "admin" ? "Course Catalog" : "My Courses"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {userRole === "admin" ? "Browse all available courses" : "View your enrolled courses"}
              </p>
            </Link>

            <Link
              href="/profile"
              className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
            >
              <UsersIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                My Profile
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                View your account and progress
              </p>
            </Link>

            <Link
              href="/profile/achievements"
              className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
            >
              <CheckCircleIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                Achievements
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                View your badges and milestones
              </p>
            </Link>

            {userRole === "admin" && (
              <Link
                href="/courses?tab=my"
                className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
              >
                <BookOpenIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                  My Courses
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  View your enrolled and assigned courses
                </p>
              </Link>
            )}

            {userRole === "admin" && (
              <Link
                href="/admin"
                className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
              >
                <ShieldIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                  Admin Dashboard
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Manage users, courses, and roles
                </p>
              </Link>
            )}

            {(userRole === "manager" || userRole === "instructor") && (
              <Link
                href="/manager"
                className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated hover-lift"
              >
                <BookOpenIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2.5" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                  {userRole === "instructor" ? "My Teaching" : "Manager Dashboard"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userRole === "instructor" ? "View your assigned courses" : "Manage your courses and assignments"}
                </p>
              </Link>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
