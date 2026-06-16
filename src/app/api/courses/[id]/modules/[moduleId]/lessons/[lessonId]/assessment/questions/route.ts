import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

interface OptionInput {
  text: string;
  isCorrect: boolean;
}

/**
 * POST .../lessons/[lessonId]/assessment/questions
 *
 * Create a new assessment question. Admin/course_manager only.
 *
 * Request body:
 *   {
 *     text: string,
 *     questionType: "MULTIPLE_CHOICE" | "FREE_TEXT",
 *     maxMarks: number,
 *     options?: { text: string, isCorrect: boolean }[]  // required for MC, forbidden for FT
 *   }
 *
 * Response:
 *   201 { id, lessonId, text, order, questionType, maxMarks, options[], createdAt, updatedAt }
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
  let body: {
    text?: unknown;
    questionType?: unknown;
    maxMarks?: unknown;
    options?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, questionType, maxMarks, options } = body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (questionType !== "MULTIPLE_CHOICE" && questionType !== "FREE_TEXT") {
    return NextResponse.json(
      { error: "questionType must be 'MULTIPLE_CHOICE' or 'FREE_TEXT'" },
      { status: 400 },
    );
  }

  if (typeof maxMarks !== "number" || !Number.isInteger(maxMarks) || maxMarks < 1) {
    return NextResponse.json({ error: "maxMarks must be a positive integer (>= 1)" }, { status: 400 });
  }

  // Validate options per questionType
  if (questionType === "MULTIPLE_CHOICE") {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      return NextResponse.json({ error: "MULTIPLE_CHOICE questions must have 2–6 options" }, { status: 400 });
    }
    const optArr = options as OptionInput[];
    const correctCount = optArr.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json(
        { error: "Exactly one option must be marked as correct" },
        { status: 400 },
      );
    }
    for (const opt of optArr) {
      if (!opt.text || typeof opt.text !== "string" || opt.text.trim() === "") {
        return NextResponse.json({ error: "All options must have text" }, { status: 400 });
      }
    }
  } else {
    // FREE_TEXT
    if (options !== undefined && options !== null) {
      return NextResponse.json(
        { error: "FREE_TEXT questions must not include options" },
        { status: 400 },
      );
    }
  }

  // Auto-assign order = max existing order + 1 (or 1 if no questions yet)
  const maxOrderRow = await prisma.assessmentQuestion.aggregate({
    where: { lessonId },
    _max: { order: true },
  });
  const order = (maxOrderRow._max.order ?? 0) + 1;

  const question = await prisma.assessmentQuestion.create({
    data: {
      lessonId,
      text: (text as string).trim(),
      order,
      questionType: questionType as "MULTIPLE_CHOICE" | "FREE_TEXT",
      maxMarks: maxMarks as number,
      options:
        questionType === "MULTIPLE_CHOICE"
          ? {
              create: (options as OptionInput[]).map((opt, idx) => ({
                text: opt.text.trim(),
                isCorrect: opt.isCorrect,
                order: idx,
              })),
            }
          : undefined,
    },
    include: {
      options: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(question, { status: 201 });
}
