import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    completed: true,
    completedAt: progress.completedAt,
  });
}
