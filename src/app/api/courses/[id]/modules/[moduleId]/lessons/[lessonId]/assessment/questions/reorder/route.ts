import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/**
 * POST .../assessment/questions/reorder
 *
 * Reorder all assessment questions for a lesson. Admin/course_manager only.
 *
 * Uses a two-phase update to avoid @@unique([lessonId, order]) collisions:
 *   1. Shift all orders to a high temporary range (offset by 10000).
 *   2. Assign the final orders per the requested sequence.
 * Both phases run inside a single transaction.
 *
 * Request body: { orderedIds: string[] }  // all question IDs in desired order
 *
 * Response:
 *   200 { questions: AssessmentQuestion[] }
 *   400 { error: string }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;

  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  let body: { orderedIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
  }

  const orderedIds = body.orderedIds as string[];

  // Verify all IDs belong to this lesson
  const existing = await prisma.assessmentQuestion.findMany({
    where: { lessonId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));

  if (
    orderedIds.length !== existingIds.size ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    return NextResponse.json(
      { error: "orderedIds must match existing question IDs exactly" },
      { status: 400 },
    );
  }

  // Two-phase reorder to avoid @@unique([lessonId, order]) constraint violations:
  // Phase 1: shift all to a temporary high range that won't collide with any real order.
  // Phase 2: assign the final 1-based order from the requested sequence.
  const OFFSET = 100000;

  await prisma.$transaction([
    // Phase 1: temporary offset
    ...orderedIds.map((id, idx) =>
      prisma.assessmentQuestion.update({
        where: { id },
        data: { order: OFFSET + idx + 1 },
      }),
    ),
    // Phase 2: final order
    ...orderedIds.map((id, idx) =>
      prisma.assessmentQuestion.update({
        where: { id },
        data: { order: idx + 1 },
      }),
    ),
  ]);

  const questions = await prisma.assessmentQuestion.findMany({
    where: { lessonId },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ questions });
}
