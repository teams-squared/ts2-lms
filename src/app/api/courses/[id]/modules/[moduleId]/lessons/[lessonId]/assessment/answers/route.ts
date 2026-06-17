import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answerDataFor } from "@/lib/assessment";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

interface AnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  selectedOptionIds?: string[] | null;
  responseText?: string | null;
}

/**
 * PUT .../lessons/[lessonId]/assessment/answers
 *
 * Autosave draft answers for an in-progress submission. Called on a debounce
 * from the client — kept tolerant/fast. Does NOT finalize.
 *
 * Request body: { submissionId: string, answers: AnswerInput[] }
 *
 * Response:
 *   200 { ok: true }
 *   400 { error: string }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 *   409 { error: "expired" | string }
 */
export async function PUT(request: Request, { params }: Params) {
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
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "answers must be an array" }, { status: 400 });
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

  const now = new Date();
  if (now > submission.deadlineAt) {
    return NextResponse.json({ error: "expired" }, { status: 409 });
  }

  if (submission.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Submission is no longer in progress" },
      { status: 409 },
    );
  }

  // Validate questionIds belong to this submission's assigned variant
  if (answers.length > 0) {
    const variantQuestions = submission.variantId
      ? await prisma.assessmentQuestion.findMany({
          where: { variantId: submission.variantId },
          select: { id: true, questionType: true },
        })
      : [];
    const questionMap = new Map(variantQuestions.map((q) => [q.id, q]));

    for (const ans of answers) {
      if (!ans.questionId || typeof ans.questionId !== "string") {
        return NextResponse.json({ error: "Each answer must have a questionId" }, { status: 400 });
      }
      if (!questionMap.has(ans.questionId)) {
        return NextResponse.json(
          { error: `Question ${ans.questionId} does not belong to this assessment` },
          { status: 400 },
        );
      }
    }

    // Upsert each answer
    await Promise.all(
      answers.map((ans) => {
        const q = questionMap.get(ans.questionId)!;
        const data = answerDataFor(q.questionType, ans);

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

  return NextResponse.json({ ok: true });
}
