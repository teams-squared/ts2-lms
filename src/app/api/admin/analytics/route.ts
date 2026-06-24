import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { ACTIVE_USER, ACTIVE_ENROLLMENT_USER } from "@/lib/users";

/**
 * GET /api/admin/analytics — aggregate LMS analytics for admins.
 * Returns overview stats, per-course metrics, and per-user metrics.
 */
export async function GET() {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Parallel queries for overview stats
  const [
    totalUsers,
    totalEnrollments,
    totalQuizAttempts,
    activeUsers7d,
    courses,
    users,
  ] = await Promise.all([
    prisma.user.count({ where: { ...ACTIVE_USER } }),
    prisma.enrollment.count({ where: { ...ACTIVE_ENROLLMENT_USER } }),
    prisma.quizAttempt.count(),
    prisma.userStats.count({
      where: { lastActivityDate: { gte: sevenDaysAgo }, user: { ...ACTIVE_USER } },
    }),
    getCourseMetrics(),
    getUserMetrics(),
  ]);

  // Calculate avg completion rate from course metrics
  const coursesWithEnrollments = courses.filter((c) => c.enrolledCount > 0);
  const avgCompletionRate =
    coursesWithEnrollments.length > 0
      ? Math.round(
          coursesWithEnrollments.reduce((sum, c) => sum + c.completionPercent, 0) /
            coursesWithEnrollments.length,
        )
      : 0;

  return NextResponse.json({
    overview: {
      totalUsers,
      totalEnrollments,
      totalQuizAttempts,
      activeUsers7d,
      avgCompletionRate,
    },
    courses,
    users,
  });
}

async function getCourseMetrics() {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      modules: {
        select: {
          lessons: { select: { id: true } },
        },
      },
      // Include offboardedAt so we can exclude offboarded learners from
      // completion % denominator without a separate query.
      enrollments: { select: { userId: true, user: { select: { offboardedAt: true } } } },
    },
    orderBy: { title: "asc" },
  });

  // Union of every published-course lesson id + enrolled user id, plus a
  // lesson→course map — so completion + quiz stats come from TWO batch reads
  // instead of a `lessonProgress.count` per user×course and a `quizAttempt`
  // findMany per course (was O(C×U + C) round-trips).
  const courseLessonIds = new Map<string, string[]>();
  const lessonToCourse = new Map<string, string>();
  const allUserIds = new Set<string>();
  for (const course of courses) {
    const ids = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    courseLessonIds.set(course.id, ids);
    for (const id of ids) lessonToCourse.set(id, course.id);
    for (const e of course.enrollments) {
      // Skip offboarded learners — they don't count toward completion metrics.
      if (e.user.offboardedAt == null) allUserIds.add(e.userId);
    }
  }
  const allLessonIds = [...lessonToCourse.keys()];

  const [completedRows, quizRows] = await Promise.all([
    allLessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: {
            completedAt: { not: null },
            lessonId: { in: allLessonIds },
            userId: { in: [...allUserIds] },
          },
          select: { userId: true, lessonId: true },
        })
      : Promise.resolve([] as { userId: string; lessonId: string }[]),
    allLessonIds.length > 0
      ? prisma.quizAttempt.findMany({
          where: { lessonId: { in: allLessonIds } },
          select: { lessonId: true, score: true, totalQuestions: true },
        })
      : Promise.resolve([] as { lessonId: string; score: number; totalQuestions: number }[]),
  ]);

  // userId → set of completed lesson ids
  const completedByUser = new Map<string, Set<string>>();
  for (const r of completedRows) {
    let s = completedByUser.get(r.userId);
    if (!s) {
      s = new Set();
      completedByUser.set(r.userId, s);
    }
    s.add(r.lessonId);
  }
  // courseId → { summed % , attempt count }
  const quizByCourse = new Map<string, { sum: number; count: number }>();
  for (const a of quizRows) {
    const cid = lessonToCourse.get(a.lessonId);
    if (!cid) continue;
    const bucket = quizByCourse.get(cid) ?? { sum: 0, count: 0 };
    bucket.sum += a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0;
    bucket.count += 1;
    quizByCourse.set(cid, bucket);
  }

  return courses.map((course) => {
    const lessonIds = courseLessonIds.get(course.id) ?? [];
    // Filter out offboarded learners from completion denominator and numerator.
    const enrolledUserIds = course.enrollments
      .filter((e) => e.user.offboardedAt == null)
      .map((e) => e.userId);
    const enrolledCount = enrolledUserIds.length;

    let completedCount = 0;
    let avgQuizScore: number | null = null;
    if (enrolledCount > 0 && lessonIds.length > 0) {
      for (const userId of enrolledUserIds) {
        const done = completedByUser.get(userId);
        if (done && lessonIds.every((id) => done.has(id))) completedCount++;
      }
      const quiz = quizByCourse.get(course.id);
      avgQuizScore = quiz && quiz.count > 0 ? Math.round(quiz.sum / quiz.count) : null;
    }

    return {
      id: course.id,
      title: course.title,
      enrolledCount,
      completedCount,
      completionPercent:
        enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0,
      avgQuizScore,
      totalLessons: lessonIds.length,
    };
  });
}

async function getUserMetrics() {
  const users = await prisma.user.findMany({
    where: { ...ACTIVE_USER },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      stats: { select: { xp: true, streak: true, lastActivityDate: true } },
      // Count relations in SQL rather than pulling every row to read `.length`
      // (lessonProgress could be ~20k rows). Filtered `_count` for completions.
      _count: {
        select: {
          enrollments: true,
          lessonProgress: { where: { completedAt: { not: null } } },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role.toLowerCase(),
    enrolledCourses: u._count.enrollments,
    lessonsCompleted: u._count.lessonProgress,
    xp: u.stats?.xp ?? 0,
    streak: u.stats?.streak ?? 0,
    lastActive: u.stats?.lastActivityDate?.toISOString() ?? null,
  }));
}
