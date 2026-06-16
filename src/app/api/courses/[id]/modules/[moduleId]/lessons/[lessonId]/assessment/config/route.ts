import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/**
 * PATCH .../lessons/[lessonId]/assessment/config
 *
 * Upserts the AssessmentLesson config (timeLimitMinutes, passThreshold).
 * Admin/course_manager only.
 *
 * Request body: { timeLimitMinutes: number, passThreshold: number }
 *
 * Response:
 *   200 { id, lessonId, timeLimitMinutes, passThreshold, createdAt, updatedAt }
 *   400 { error: string }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;

  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify lesson belongs to correct module/course and is type ASSESSMENT
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  if (lesson.type !== "ASSESSMENT") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Parse body
  let body: { timeLimitMinutes?: unknown; passThreshold?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { timeLimitMinutes, passThreshold } = body;

  if (typeof timeLimitMinutes !== "number" || !Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1) {
    return NextResponse.json(
      { error: "timeLimitMinutes must be a positive integer (>= 1)" },
      { status: 400 },
    );
  }

  if (typeof passThreshold !== "number" || !Number.isInteger(passThreshold) || passThreshold < 0) {
    return NextResponse.json(
      { error: "passThreshold must be a non-negative integer (>= 0)" },
      { status: 400 },
    );
  }

  const config = await prisma.assessmentLesson.upsert({
    where: { lessonId },
    create: { lessonId, timeLimitMinutes, passThreshold },
    update: { timeLimitMinutes, passThreshold },
  });

  return NextResponse.json(config);
}
