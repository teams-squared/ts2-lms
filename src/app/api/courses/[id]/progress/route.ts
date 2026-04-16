import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDeadline, getDeadlineStatus } from "@/lib/deadlines";
import type { CourseProgress } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/courses/[id]/progress — return enrollment + per-lesson completion for the current user. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;
  const userId = session.user.id;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  // Fetch all lesson IDs for this course
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: { lessons: { select: { id: true, deadlineDays: true } } },
  });
  const allLessons = modules.flatMap((m) => m.lessons);
  const allLessonIds = allLessons.map((l) => l.id);
  const lessonDeadlineMap = new Map(allLessons.map((l) => [l.id, l.deadlineDays]));

  if (!enrollment) {
    const progress: CourseProgress = {
      enrolled: false,
      enrolledAt: null,
      totalLessons: allLessonIds.length,
      completedLessons: 0,
      percentComplete: 0,
      lessons: allLessonIds.map((id) => ({
        lessonId: id,
        completed: false,
        completedAt: null,
        deadlineDays: lessonDeadlineMap.get(id) ?? null,
        absoluteDeadline: null,
        deadlineStatus: "none" as const,
      })),
    };
    return NextResponse.json(progress);
  }

  const progressRecords = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: allLessonIds } },
  });

  const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));
  const totalLessons = allLessonIds.length;
  const completedLessons = progressRecords.filter((p) => p.completedAt !== null).length;
  const percentComplete =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 1000) / 10;

  const progress: CourseProgress = {
    enrolled: true,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    totalLessons,
    completedLessons,
    percentComplete,
    lessons: allLessonIds.map((id) => {
      const record = progressMap.get(id);
      const deadlineDays = lessonDeadlineMap.get(id) ?? null;
      const completedAt = record?.completedAt ?? null;
      const absoluteDeadline = deadlineDays != null
        ? computeDeadline(enrollment.enrolledAt, deadlineDays).toISOString()
        : null;
      return {
        lessonId: id,
        completed: completedAt != null,
        completedAt: completedAt?.toISOString() ?? null,
        deadlineDays,
        absoluteDeadline,
        deadlineStatus: getDeadlineStatus(enrollment.enrolledAt, deadlineDays, completedAt),
      };
    }),
  };

  return NextResponse.json(progress);
}
