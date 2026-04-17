import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Logo from "@/components/Logo";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineStatus } from "@/lib/deadlines";
import type { Role } from "@/lib/types";
import { WelcomeBar } from "@/components/dashboard/WelcomeBar";
import { NextStepBanner } from "@/components/dashboard/NextStepBanner";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";
import { CourseProgressList } from "@/components/dashboard/CourseProgressList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  // ── Logged-out landing page ────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center mb-2">
            <Logo size={48} showText={false} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Teams Squared{" "}
              <span className="text-primary">LMS</span>
            </h1>
            <p className="text-base text-foreground-muted">
              Sign in to access your learning platform.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 active:bg-primary/80 transition-colors shadow-lg shadow-primary/25 text-sm"
          >
            Sign in
          </Link>
        </div>
        <p className="absolute bottom-6 text-xs text-foreground-subtle">
          &copy; {new Date().getFullYear()} Teams Squared
        </p>
      </div>
    );
  }

  // ── Logged-in dashboard ────────────────────────────────────────────────────
  const userId = session.user!.id!;
  const userRole = (session.user?.role as Role) || "employee";
  const firstName = session.user?.name?.split(" ")[0] || "there";

  // Fetch enrollments (with full course/module/lesson structure) and user stats in parallel.
  const [enrollments, userStats] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            category: true,
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

  const enrichedEnrollments = enrollments.map((e) => {
    const allLessons = e.course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;
    const completedLessons = allLessons.filter((l) => completedIdSet.has(l.id)).length;
    const percentComplete =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const isComplete = totalLessons > 0 && completedLessons === totalLessons;
    const firstIncompleteLesson =
      allLessons.find((l) => !completedIdSet.has(l.id)) ?? allLessons[0];
    const firstIncompleteLessonId = firstIncompleteLesson?.id;
    const firstIncompleteLessonTitle = firstIncompleteLesson?.title ?? "";
    const continueUrl = firstIncompleteLessonId
      ? `/courses/${e.course.id}/lessons/${firstIncompleteLessonId}`
      : `/courses/${e.course.id}`;
    return {
      ...e,
      totalLessons,
      completedLessons,
      percentComplete,
      isComplete,
      continueUrl,
      firstIncompleteLessonId,
      firstIncompleteLessonTitle,
    };
  });

  const inProgressCourses = enrichedEnrollments.filter((c) => !c.isComplete && c.totalLessons > 0);
  const completedCourses = enrichedEnrollments.filter((c) => c.isComplete);

  // Sort in-progress courses by percentComplete DESC so nearly-finished courses appear first,
  // encouraging completion.
  const sortedInProgressCourses = [...inProgressCourses].sort(
    (a, b) => b.percentComplete - a.percentComplete,
  );

  // The next step is the most-progressed in-progress course.
  const nextStepCourse = sortedInProgressCourses[0] ?? null;
  const nextStepIsOverdue =
    nextStepCourse != null &&
    deadlineItems.some(
      (d) => d.lessonId === nextStepCourse.firstIncompleteLessonId && d.status === "overdue",
    );

  return (
    <div>
      <WelcomeBar
        firstName={firstName}
        xp={userStats?.xp ?? 0}
        streak={userStats?.streak ?? 0}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        {nextStepCourse && (
          <NextStepBanner
            courseTitle={nextStepCourse.course.title}
            lessonTitle={nextStepCourse.firstIncompleteLessonTitle}
            completedLessons={nextStepCourse.completedLessons}
            totalLessons={nextStepCourse.totalLessons}
            percentComplete={nextStepCourse.percentComplete}
            continueUrl={nextStepCourse.continueUrl}
            isOverdue={nextStepIsOverdue}
          />
        )}

        <DeadlineAlerts deadlines={deadlineItems} />

        <CourseProgressList
          courses={sortedInProgressCourses.map((c) => ({
            courseId: c.course.id,
            courseTitle: c.course.title,
            category: c.course.category,
            completedLessons: c.completedLessons,
            totalLessons: c.totalLessons,
            percentComplete: c.percentComplete,
            continueUrl: c.continueUrl,
          }))}
          completedCount={completedCourses.length}
          hasEnrollments={enrichedEnrollments.length > 0}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
