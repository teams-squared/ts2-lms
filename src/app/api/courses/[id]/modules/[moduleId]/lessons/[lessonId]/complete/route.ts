import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { sendCourseCompletionEmail } from "@/lib/email";
import { computeCourseCompletionStats } from "@/lib/enrollments";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/** POST .../lessons/[lessonId]/complete — mark a lesson complete for the current user (idempotent). */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  // Verify the lesson exists and belongs to the correct module and course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // User must be enrolled to track progress
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "Must be enrolled to track progress" },
      { status: 403 },
    );
  }

  // Locked enrollments are read-only. The learner can still browse lessons
  // for review, but nothing they do can add/remove progress rows or re-fire
  // the course-completion modal. Only an admin reset (clearing
  // enrollment.completedAt) unlocks the course again.
  if (enrollment.completedAt != null) {
    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return NextResponse.json({
      completed: existing?.completedAt != null,
      completedAt: existing?.completedAt ?? null,
      xpAwarded: 0,
      newAchievements: [],
      courseComplete: false,
      courseStats: null,
      locked: true,
    });
  }

  const now = new Date();
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, startedAt: now, completedAt: now },
    update: { completedAt: now },
  });

  // Award XP and track event (fire-and-forget)
  const { newAchievements } = await awardXp(userId, 10);
  trackEvent(userId, "lesson_completed", { courseId, moduleId, lessonId });

  // ── Course completion check ───────────────────────────────────────────────
  // firstCompletion fires exactly once per enrollment: when all lessons are done
  // AND enrollment.completedAt is still null. Re-completing after un/re-doing a
  // lesson does NOT fire again because completedAt is sticky (never reset on DELETE).
  let courseComplete = false;
  let courseStats: {
    courseTitle: string;
    totalLessons: number;
    completedLessons: number;
    xpEarned: number;
    daysTaken: number;
  } | null = null;

  try {
    const allModules = await prisma.module.findMany({
      where: { courseId },
      include: { lessons: { select: { id: true } } },
    });
    const allLessonIds = (allModules ?? []).flatMap((m) => m.lessons.map((l) => l.id));

    if (allLessonIds.length > 0) {
      const completedCount = await prisma.lessonProgress.count({
        where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
      });

      const firstCompletion = completedCount >= allLessonIds.length && enrollment.completedAt === null;

      if (firstCompletion) {
        // Stamp the enrollment — subsequent re-completions won't trigger this block
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { completedAt: now },
        });

        // Award course-completion XP bonus
        await awardXp(userId, 100);

        // Fire analytics event
        const stats = await computeCourseCompletionStats(userId, courseId, enrollment.enrolledAt);
        trackEvent(userId, "course_completed", {
          courseId,
          xpEarned: stats.xpEarned,
          daysTaken: stats.daysTaken,
          lessonCount: stats.totalLessons,
        });

        // Send completion alert emails
        const [subs, userData] = await Promise.all([
          prisma.courseEmailSubscription.findMany({ where: { courseId }, select: { email: true } }),
          prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        ]);
        if (subs.length > 0) {
          sendCourseCompletionEmail(
            subs.map((s) => s.email),
            userData?.name ?? userData?.email ?? "A user",
            stats.courseTitle,
          ).catch((err) => console.error("[email] completion alert failed:", err));
        }

        courseComplete = true;
        courseStats = stats;
      }
      // If completedCount >= total but enrollment.completedAt is already set:
      // re-completion after un/re-complete — no XP, no event, no email, courseComplete stays false.
    }
  } catch {
    // Course completion check is non-critical; don't fail the request
  }

  return NextResponse.json({
    completed: true,
    completedAt: progress.completedAt,
    xpAwarded: 10,
    newAchievements: newAchievements.map((a) => ({
      key: a.key,
      title: a.title,
      icon: a.icon,
    })),
    courseComplete,
    courseStats,
  });
}

/** DELETE .../lessons/[lessonId]/complete — unmark a lesson as complete (clears completedAt).
 *
 * NOTE: enrollment.completedAt is intentionally NOT reset here. "You earned the
 * completion" is a sticky state — the modal should never re-fire for a course
 * the learner already crossed the finish line on.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "Must be enrolled to track progress" },
      { status: 403 },
    );
  }

  // Locked at completed — only an admin reset can clear progress on a
  // completed enrollment. UI mirrors this by hiding the unmark button, but
  // we enforce it here too.
  if (enrollment.completedAt != null) {
    return NextResponse.json(
      { error: "Course is locked at completed. Ask an admin to reset progress." },
      { status: 409 },
    );
  }

  await prisma.lessonProgress.updateMany({
    where: { userId, lessonId },
    data: { completedAt: null },
  });

  return NextResponse.json({ completed: false });
}
