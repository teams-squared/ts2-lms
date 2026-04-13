import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

interface OptionInput {
  text: string;
  isCorrect: boolean;
}

/** POST .../lessons/[lessonId]/quiz/questions — add a quiz question (admin/manager only) */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPrivileged = session.user.role === "admin" || session.user.role === "manager";
  if (!isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: courseId, moduleId, lessonId } = await params;

  // Verify lesson exists and belongs to the correct module/course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Parse body
  let body: { text?: string; options?: OptionInput[] };
  try {
    body = (await request.json()) as { text?: string; options?: OptionInput[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, options } = body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
    return NextResponse.json(
      { error: "Must provide 2-4 options" },
      { status: 400 },
    );
  }

  const correctOptions = options.filter((o) => o.isCorrect);
  if (correctOptions.length !== 1) {
    return NextResponse.json(
      { error: "Exactly one option must be marked as correct" },
      { status: 400 },
    );
  }

  for (const opt of options) {
    if (!opt.text || typeof opt.text !== "string" || opt.text.trim() === "") {
      return NextResponse.json({ error: "All options must have text" }, { status: 400 });
    }
  }

  // Auto-assign order (next available)
  const existingCount = await prisma.quizQuestion.count({ where: { lessonId } });
  const order = existingCount + 1;

  // Create question with options
  const question = await prisma.quizQuestion.create({
    data: {
      lessonId,
      text: text.trim(),
      order,
      options: {
        create: options.map((opt, idx) => ({
          text: opt.text.trim(),
          isCorrect: opt.isCorrect,
          order: idx + 1,
        })),
      },
    },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json(question, { status: 201 });
}
