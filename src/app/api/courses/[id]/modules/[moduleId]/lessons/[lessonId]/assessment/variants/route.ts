import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/**
 * GET .../lessons/[lessonId]/assessment/variants
 *
 * List all variants for an assessment lesson, with questions and options.
 * Admin/course_manager only (builder view — includes isCorrect).
 *
 * Response:
 *   200 { variants: [{ id, label, order, questions: [{ id, text, order, questionType, maxMarks, options: [{ id, text, isCorrect, order }] }] }] }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 */
export async function GET(_request: Request, { params }: Params) {
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

  const variants = await prisma.assessmentVariant.findMany({
    where: { lessonId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      label: true,
      order: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          text: true,
          order: true,
          questionType: true,
          maxMarks: true,
          options: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              text: true,
              isCorrect: true,
              order: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ variants });
}

/**
 * POST .../lessons/[lessonId]/assessment/variants
 *
 * Create a new assessment variant. Admin/course_manager only.
 *
 * Request body: { label: string }
 *
 * Response:
 *   201 { id, label, order }
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

  let body: { label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { label } = body;

  if (!label || typeof label !== "string" || label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  // Auto-assign order = max existing order + 1 (or 1 if no variants yet)
  const maxOrderRow = await prisma.assessmentVariant.aggregate({
    where: { lessonId },
    _max: { order: true },
  });
  const order = (maxOrderRow._max.order ?? 0) + 1;

  const variant = await prisma.assessmentVariant.create({
    data: {
      lessonId,
      label: label.trim(),
      order,
    },
    select: {
      id: true,
      label: true,
      order: true,
    },
  });

  return NextResponse.json(variant, { status: 201 });
}
