import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { sendCourseCompletionEmail } from "@/lib/email";

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

  const now = new Date();
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, startedAt: now, completedAt: now },
    update: { completedAt: now },
  });

  // Award XP and track event (fire-and-forget)
  const { newAchievements } = await awardXp(userId, 10);
  trackEvent(userId, "lesson_completed", { courseId, moduleId, lessonId });

  // Check if entire course is now complete
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
      if (completedCount >= allLessonIds.length) {
        await awardXp(userId, 100);
        trackEvent(userId, "course_completed", { courseId });

        // Send completion alert emails
        const [subs, courseData, userData] = await Promise.all([
          prisma.courseEmailSubscription.findMany({ where: { courseId }, select: { email: true } }),
          prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
          prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        ]);
        if (subs.length > 0) {
          sendCourseCompletionEmail(
            subs.map((s) => s.email),
            userData?.name ?? userData?.email ?? "A user",
            courseData?.title ?? "a course",
          ).catch((err) => console.error("[email] completion alert failed:", err));
        }
      }
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
  });
}

/** DELETE .../lessons/[lessonId]/complete — unmark a lesson as complete (clears completedAt). */
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

  await prisma.lessonProgress.updateMany({
    where: { userId, lessonId },
    data: { completedAt: null },
  });

  return NextResponse.json({ completed: false });
}
