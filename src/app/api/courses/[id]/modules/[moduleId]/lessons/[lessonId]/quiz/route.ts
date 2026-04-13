import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/** GET .../lessons/[lessonId]/quiz — fetch quiz questions, options, passing score, and best attempt */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;
  const isPrivileged = session.user.role === "admin" || session.user.role === "manager";

  // Verify lesson exists and belongs to the correct module/course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Parse passingScore from lesson.content JSON
  let passingScore = 70;
  if (lesson.content) {
    try {
      const parsed = JSON.parse(lesson.content) as { passingScore?: number };
      if (typeof parsed.passingScore === "number") {
        passingScore = parsed.passingScore;
      }
    } catch {
      // use default
    }
  }

  // Fetch questions with options
  const questions = await prisma.quizQuestion.findMany({
    where: { lessonId },
    include: {
      options: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });

  // For employees: omit isCorrect from options
  const sanitizedQuestions = questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text,
      order: o.order,
      ...(isPrivileged ? { isCorrect: o.isCorrect } : {}),
    })),
  }));

  // Fetch best attempt for this user on this lesson
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, lessonId },
    orderBy: { createdAt: "desc" },
  });

  const bestAttempt = attempts.length > 0
    ? attempts.reduce((best, a) => (a.score > best.score ? a : best), attempts[0])
    : null;

  return NextResponse.json({
    questions: sanitizedQuestions,
    passingScore,
    bestAttempt: bestAttempt
      ? {
          id: bestAttempt.id,
          score: bestAttempt.score,
          totalQuestions: bestAttempt.totalQuestions,
          passed: bestAttempt.passed,
          createdAt: bestAttempt.createdAt,
        }
      : null,
  });
}
