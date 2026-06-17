import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = {
  params: Promise<{
    id: string;
    moduleId: string;
    lessonId: string;
    variantId: string;
    questionId: string;
  }>;
};

interface OptionInput {
  id?: string;
  text: string;
  isCorrect: boolean;
}

/**
 * PATCH .../variants/[variantId]/questions/[questionId]
 *
 * Edit text, maxMarks, and/or options for an assessment question.
 * For MC questions, options are fully replaced (delete + recreate strategy).
 * Admin/course_manager only.
 *
 * Request body (all fields optional):
 *   {
 *     text?: string,
 *     maxMarks?: number,
 *     options?: { id?: string, text: string, isCorrect: boolean }[]  // MC only — full replacement
 *   }
 *
 * Response:
 *   200 { id, variantId, text, order, questionType, maxMarks, options[], createdAt, updatedAt }
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

  const { id: courseId, moduleId, lessonId, variantId, questionId } = await params;

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

  // Verify variant belongs to this lesson
  const variant = await prisma.assessmentVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant || variant.lessonId !== lessonId) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const question = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });

  if (!question || question.variantId !== variantId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let body: { text?: unknown; maxMarks?: unknown; options?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate text if provided
  if (body.text !== undefined) {
    if (typeof body.text !== "string" || body.text.trim() === "") {
      return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
    }
  }

  // Validate maxMarks if provided
  if (body.maxMarks !== undefined) {
    if (typeof body.maxMarks !== "number" || !Number.isInteger(body.maxMarks) || body.maxMarks < 1) {
      return NextResponse.json({ error: "maxMarks must be a positive integer (>= 1)" }, { status: 400 });
    }
  }

  // Validate options if provided. MC needs exactly one correct; MULTI_SELECT
  // needs at least one; FREE_TEXT has no options.
  if (body.options !== undefined) {
    if (question.questionType === "FREE_TEXT") {
      return NextResponse.json(
        { error: "FREE_TEXT questions do not have options" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6) {
      return NextResponse.json({ error: "Must provide 2–6 options" }, { status: 400 });
    }
    const opts = body.options as OptionInput[];
    const correctCount = opts.filter((o) => o.isCorrect).length;
    if (question.questionType === "MULTIPLE_CHOICE" && correctCount !== 1) {
      return NextResponse.json({ error: "Exactly one option must be correct" }, { status: 400 });
    }
    if (question.questionType === "MULTI_SELECT" && correctCount < 1) {
      return NextResponse.json({ error: "At least one option must be correct" }, { status: 400 });
    }
    for (const opt of opts) {
      if (!opt.text?.trim()) {
        return NextResponse.json({ error: "All options must have text" }, { status: 400 });
      }
    }
  }

  // Update question text / maxMarks
  const updateData: { text?: string; maxMarks?: number } = {};
  if (body.text !== undefined) updateData.text = (body.text as string).trim();
  if (body.maxMarks !== undefined) updateData.maxMarks = body.maxMarks as number;

  if (Object.keys(updateData).length > 0) {
    await prisma.assessmentQuestion.update({
      where: { id: questionId },
      data: updateData,
    });
  }

  // Sync options for MC questions (delete + recreate strategy)
  if (body.options !== undefined) {
    const newOptions = body.options as OptionInput[];
    const incomingIds = new Set(
      newOptions.map((o) => o.id).filter((id): id is string => Boolean(id)),
    );
    const existingIds = question.options.map((o) => o.id);
    const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

    await prisma.$transaction([
      ...(idsToDelete.length > 0
        ? [prisma.assessmentOption.deleteMany({ where: { id: { in: idsToDelete } } })]
        : []),
      ...newOptions.map((opt, idx) =>
        opt.id
          ? prisma.assessmentOption.update({
              where: { id: opt.id },
              data: { text: opt.text.trim(), isCorrect: opt.isCorrect, order: idx },
            })
          : prisma.assessmentOption.create({
              data: {
                questionId,
                text: opt.text.trim(),
                isCorrect: opt.isCorrect,
                order: idx,
              },
            }),
      ),
    ]);
  }

  const updated = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE .../variants/[variantId]/questions/[questionId]
 *
 * Remove an assessment question (cascade handles options and answers).
 * Admin/course_manager only.
 *
 * Response:
 *   200 { deleted: true }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId, variantId, questionId } = await params;

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

  // Verify variant belongs to this lesson
  const variant = await prisma.assessmentVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant || variant.lessonId !== lessonId) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const question = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question || question.variantId !== variantId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  await prisma.assessmentQuestion.delete({ where: { id: questionId } });

  return NextResponse.json({ deleted: true });
}
