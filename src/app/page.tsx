import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Logo from "@/components/Logo";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineStatus } from "@/lib/deadlines";
import type { Role } from "@/lib/types";
import { WelcomeBar } from "@/components/dashboard/WelcomeBar";
import { HeroNextStep } from "@/components/dashboard/HeroNextStep";
import { CourseProgressGrid } from "@/components/dashboard/CourseProgressGrid";
import { DeadlinesPanel } from "@/components/dashboard/DeadlinesPanel";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickLinksRow } from "@/components/dashboard/QuickLinksRow";

export const dynamic = "force-dynamic";

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

  // Split: first in-progress course is the hero, rest go in the grid
  const heroNextCourse = inProgressCourses[0] ?? null;
  const remainingCourses = inProgressCourses.slice(1);
  const totalCompletedLessons = completedIdSet.size;

  // Flatten recent activity for the component
  const activityItems = recentProgress.map((p) => ({
    id: p.id,
    completedAt: p.completedAt!,
    lessonTitle: p.lesson.title,
    courseId: p.lesson.module.course.id,
    courseTitle: p.lesson.module.course.title,
  }));

  return (
    <div>
      {/* ── Compact welcome bar ──────────────────────────────────────────── */}
      <WelcomeBar
        firstName={firstName}
        email={session.user?.email ?? ""}
        userRole={userRole}
        xp={userStats?.xp ?? 0}
        streak={userStats?.streak ?? 0}
        completedCount={completedCourses.length}
      />

      {/* ── Two-column dashboard layout ──────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary column */}
          <div className="lg:col-span-2 space-y-6">
            <HeroNextStep
              course={heroNextCourse ? {
                courseTitle: heroNextCourse.course.title,
                completedLessons: heroNextCourse.completedLessons,
                totalLessons: heroNextCourse.totalLessons,
                percentComplete: heroNextCourse.percentComplete,
                continueUrl: heroNextCourse.continueUrl,
              } : null}
            />

            <CourseProgressGrid
              courses={remainingCourses.map((c) => ({
                courseId: c.course.id,
                courseTitle: c.course.title,
                completedLessons: c.completedLessons,
                totalLessons: c.totalLessons,
                percentComplete: c.percentComplete,
                continueUrl: c.continueUrl,
              }))}
              hasEnrollments={enrichedEnrollments.length > 0}
              userRole={userRole}
            />

            <StatsStrip
              xp={userStats?.xp ?? 0}
              streak={userStats?.streak ?? 0}
              completedCoursesCount={completedCourses.length}
              completedLessonsCount={totalCompletedLessons}
            />

            <RecentActivity items={activityItems} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-[4.5rem] lg:self-start">
            <DeadlinesPanel deadlines={topDeadlines} />
            <QuickLinksRow userRole={userRole} />
          </div>
        </div>
      </div>
    </div>
  );
}
