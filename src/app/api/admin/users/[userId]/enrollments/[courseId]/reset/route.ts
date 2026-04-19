import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ userId: string; courseId: string }> };

/**
 * POST /api/admin/users/[userId]/enrollments/[courseId]/reset
 *
 * Wipe a learner's progress for a single course and clear the sticky
 * enrollment.completedAt stamp, unlocking the course so they can take it
 * again from scratch.
 *
 * Effects (transactional):
 *   - Delete LessonProgress rows for (userId × lessons in course)
 *   - Delete QuizAttempt rows for the same scope (cascades QuizAnswer)
 *   - Set enrollment.completedAt = null
 *
 * NOT touched:
 *   - The enrollment itself (the user stays enrolled, just at 0%).
 *   - XP, streak, achievements (reversing those is messy and not what we want
 *     for a "let them retake it" reset).
 *   - Any other course's progress.
 *
 * Admin-only — same role guard as other destructive admin operations.
 */
export async function POST(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: adminId } = authResult;

  const { userId, courseId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      completedAt: true,
      course: { select: { title: true } },
    },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  // Lesson IDs in this course — scope the wipe so we only touch progress for
  // lessons that actually belong to it. (LessonProgress and QuizAttempt are
  // keyed by lessonId, not courseId.)
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const lessonIds = lessons.map((l) => l.id);

  let progressDeleted = 0;
  let attemptsDeleted = 0;

  await prisma.$transaction(async (tx) => {
    if (lessonIds.length > 0) {
      const p = await tx.lessonProgress.deleteMany({
        where: { userId, lessonId: { in: lessonIds } },
      });
      progressDeleted = p.count;
      // QuizAnswer rows cascade off QuizAttempt deletion via the schema FK.
      const a = await tx.quizAttempt.deleteMany({
        where: { userId, lessonId: { in: lessonIds } },
      });
      attemptsDeleted = a.count;
    }
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { completedAt: null },
    });
  });

  trackEvent(adminId, "enrollment_progress_reset", {
    targetUserId: userId,
    courseId,
    courseTitle: enrollment.course.title,
    wasCompleted: enrollment.completedAt !== null,
    progressDeleted,
    attemptsDeleted,
  });

  return NextResponse.json({
    reset: true,
    progressDeleted,
    attemptsDeleted,
    wasCompleted: enrollment.completedAt !== null,
  });
}
