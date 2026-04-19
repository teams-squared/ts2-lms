import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = {
  params: Promise<{ id: string; moduleId: string; lessonId: string; questionId: string }>;
};

/** PATCH .../quiz/questions/[questionId] — edit question text and/or options */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId, questionId } = await params;

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

  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });

  if (!question || question.lessonId !== lessonId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Options can be sent with an existing `id` (update in place) or without one
  // (create as a new option). Any existing option whose id is omitted from the
  // payload is deleted. Order is taken from the array index — the client owns
  // ordering. Caveat: deleting an option cascades QuizAnswer rows that
  // reference it (see schema.prisma) — historical learner attempts lose those
  // answer rows. Acceptable while quizzes are still being authored.
  let body: {
    text?: string;
    options?: { id?: string; text: string; isCorrect: boolean }[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6) {
      return NextResponse.json({ error: "Must provide 2–6 options" }, { status: 400 });
    }
    const correctCount = body.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json({ error: "Exactly one option must be correct" }, { status: 400 });
    }
    for (const opt of body.options) {
      if (!opt.text?.trim()) {
        return NextResponse.json({ error: "All options must have text" }, { status: 400 });
      }
    }
  }

  // Update question text if provided
  if (body.text !== undefined) {
    const text = body.text.trim();
    if (!text) {
      return NextResponse.json({ error: "Question text cannot be empty" }, { status: 400 });
    }
    await prisma.quizQuestion.update({
      where: { id: questionId },
      data: { text },
    });
  }

  // Sync options if provided: delete missing, update existing, create new.
  if (body.options !== undefined) {
    const newOptions = body.options;
    const incomingIds = new Set(
      newOptions.map((o) => o.id).filter((id): id is string => Boolean(id)),
    );
    const existingIds = question.options.map((o) => o.id);
    const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));

    await prisma.$transaction([
      ...(idsToDelete.length > 0
        ? [prisma.quizOption.deleteMany({ where: { id: { in: idsToDelete } } })]
        : []),
      ...newOptions.map((opt, idx) =>
        opt.id
          ? prisma.quizOption.update({
              where: { id: opt.id },
              data: { text: opt.text.trim(), isCorrect: opt.isCorrect, order: idx },
            })
          : prisma.quizOption.create({
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

  // Return updated question with options
  const updated = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}

/** DELETE .../quiz/questions/[questionId] — remove a question (admin/manager/instructor only) */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId, questionId } = await params;

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

  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question || question.lessonId !== lessonId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  await prisma.quizQuestion.delete({ where: { id: questionId } });

  return NextResponse.json({ deleted: true });
}
