import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

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
    prisma.user.count(),
    prisma.enrollment.count(),
    prisma.quizAttempt.count(),
    prisma.userStats.count({
      where: { lastActivityDate: { gte: sevenDaysAgo } },
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
      enrollments: { select: { userId: true } },
    },
    orderBy: { title: "asc" },
  });

  const results = [];

  for (const course of courses) {
    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const enrolledCount = course.enrollments.length;
    const enrolledUserIds = course.enrollments.map((e) => e.userId);

    let completedCount = 0;
    let totalQuizScore = 0;
    let quizAttemptCount = 0;

    if (enrolledCount > 0 && allLessonIds.length > 0) {
      // Count users who completed all lessons
      for (const userId of enrolledUserIds) {
        const userCompleted = await prisma.lessonProgress.count({
          where: {
            userId,
            lessonId: { in: allLessonIds },
            completedAt: { not: null },
          },
        });
        if (userCompleted >= allLessonIds.length) completedCount++;
      }

      // Get quiz stats for this course
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: { lessonId: { in: allLessonIds } },
        select: { score: true, totalQuestions: true },
      });
      quizAttemptCount = quizAttempts.length;
      totalQuizScore = quizAttempts.reduce(
        (sum, a) => sum + (a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0),
        0,
      );
    }

    results.push({
      id: course.id,
      title: course.title,
      enrolledCount,
      completedCount,
      completionPercent:
        enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0,
      avgQuizScore:
        quizAttemptCount > 0 ? Math.round(totalQuizScore / quizAttemptCount) : null,
      totalLessons: allLessonIds.length,
    });
  }

  return results;
}

async function getUserMetrics() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      stats: { select: { xp: true, streak: true, lastActivityDate: true } },
      enrollments: { select: { courseId: true } },
      lessonProgress: {
        where: { completedAt: { not: null } },
        select: { lessonId: true },
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
    enrolledCourses: u.enrollments.length,
    lessonsCompleted: u.lessonProgress.length,
    xp: u.stats?.xp ?? 0,
    streak: u.stats?.streak ?? 0,
    lastActive: u.stats?.lastActivityDate?.toISOString() ?? null,
  }));
}
