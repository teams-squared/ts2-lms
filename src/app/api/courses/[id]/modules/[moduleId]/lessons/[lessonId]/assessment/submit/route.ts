import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finalizeSubmission } from "@/lib/assessment";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

interface AnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  responseText?: string | null;
}

/**
 * POST .../lessons/[lessonId]/assessment/submit
 *
 * Manually submit an in-progress assessment. Idempotent: if already finalized,
 * returns current state. Optionally accepts a final `answers` array to capture
 * last keystrokes before finalizing (no expiry rejection — we're submitting).
 *
 * Request body: { submissionId: string, answers?: AnswerInput[] }
 *
 * Response:
 *   200 { status: string, submittedAt: string | null }
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
  const userId = session.user.id;

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
  let body: { submissionId?: string; answers?: AnswerInput[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.submissionId || typeof body.submissionId !== "string") {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const { submissionId, answers } = body;

  // Load submission
  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.lessonId !== lessonId) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Idempotent: already finalized, return current state
  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json({
      status: submission.status,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
    });
  }

  // Upsert final answers if provided (capture last keystrokes; no expiry rejection)
  if (Array.isArray(answers) && answers.length > 0) {
    const lessonQuestions = await prisma.assessmentQuestion.findMany({
      where: { lessonId },
      select: { id: true, questionType: true },
    });
    const questionMap = new Map(lessonQuestions.map((q) => [q.id, q]));

    const validAnswers = answers.filter(
      (ans) =>
        ans.questionId &&
        typeof ans.questionId === "string" &&
        questionMap.has(ans.questionId),
    );

    if (validAnswers.length > 0) {
      await Promise.all(
        validAnswers.map((ans) => {
          const q = questionMap.get(ans.questionId)!;
          const data =
            q.questionType === "MULTIPLE_CHOICE"
              ? { selectedOptionId: ans.selectedOptionId ?? null, responseText: null }
              : { responseText: ans.responseText ?? null, selectedOptionId: null };

          return prisma.assessmentAnswer.upsert({
            where: {
              submissionId_questionId: { submissionId, questionId: ans.questionId },
            },
            create: {
              submissionId,
              questionId: ans.questionId,
              ...data,
            },
            update: data,
          });
        }),
      );
    }
  }

  // Finalize
  const finalized = await finalizeSubmission(submissionId, { autoSubmitted: false });

  return NextResponse.json({
    status: finalized.status,
    submittedAt: finalized.submittedAt?.toISOString() ?? null,
  });
}
