import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse } from "@/lib/courseAccess";
import { finalizeIfExpired } from "@/lib/assessment";
import { maybeCompleteCourse } from "@/lib/enrollments";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ submissionId: string }> };

// ---------------------------------------------------------------------------
// GET /api/admin/marking/[submissionId]
// Load one submission for marking (privileged — includes answer key).
// ---------------------------------------------------------------------------
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { submissionId } = await params;

  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { name: true, email: true, avatar: true } },
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: {
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          selectedOptionId: true,
          responseText: true,
          awardedMarks: true,
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const courseId = submission.lesson.module.course.id;

  const allowed = await canManageCourse(userId, role, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Lazily finalize if somehow still IN_PROGRESS and past deadline.
  await finalizeIfExpired(submission);

  // Load the assigned variant's questions WITH answer key (privileged marker path).
  const questions = submission.variantId
    ? await prisma.assessmentQuestion.findMany({
        where: { variantId: submission.variantId },
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
        },
      })
    : [];

  // Build a lookup from questionId → answer for this submission.
  const answerByQuestionId = new Map(
    submission.answers.map((a) => [a.questionId, a]),
  );

  return NextResponse.json({
    submission: {
      id: submission.id,
      status: submission.status,
      autoScore: submission.autoScore,
      manualScore: submission.manualScore,
      totalScore: submission.totalScore,
      passThreshold: submission.passThreshold,
      feedback: submission.feedback,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      autoSubmitted: submission.autoSubmitted,
      gradedAt: submission.gradedAt?.toISOString() ?? null,
    },
    student: {
      name: submission.user.name,
      email: submission.user.email,
      avatar: submission.user.avatar,
    },
    course: {
      id: submission.lesson.module.course.id,
      title: submission.lesson.module.course.title,
    },
    module: { title: submission.lesson.module.title },
    lesson: { id: submission.lesson.id, title: submission.lesson.title },
    questions: questions.map((q) => {
      const answer = answerByQuestionId.get(q.id) ?? null;
      return {
        id: q.id,
        text: q.text,
        order: q.order,
        questionType: q.questionType,
        maxMarks: q.maxMarks,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: o.order,
        })),
        answer: answer
          ? {
              selectedOptionId: answer.selectedOptionId,
              responseText: answer.responseText,
              awardedMarks: answer.awardedMarks,
            }
          : null,
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/marking/[submissionId]
// Submit marks for a SUBMITTED assessment.
// Body: { marks: { questionId: string, awardedMarks: number }[], feedback?: string, pass: boolean }
// ---------------------------------------------------------------------------
export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { submissionId } = await params;

  // Load submission with enough context for authz + processing.
  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      lesson: {
        select: {
          id: true,
          module: {
            select: {
              course: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const courseId = submission.lesson.module.course.id;
  const lessonId = submission.lesson.id;

  // Free-text questions of the submission's assigned variant — the only ones
  // a marker may award marks for (MC is auto-scored).
  const variantQuestions = submission.variantId
    ? await prisma.assessmentQuestion.findMany({
        where: { variantId: submission.variantId },
        select: { id: true, questionType: true, maxMarks: true },
      })
    : [];

  const allowed = await canManageCourse(userId, role, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (submission.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Submission is not awaiting marking" },
      { status: 409 },
    );
  }

  // Parse and validate body.
  let body: { marks?: unknown; feedback?: unknown; pass?: unknown };
  try {
    body = (await request.json()) as { marks?: unknown; feedback?: unknown; pass?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.pass !== "boolean") {
    return NextResponse.json({ error: "'pass' must be a boolean" }, { status: 400 });
  }
  if (!Array.isArray(body.marks)) {
    return NextResponse.json({ error: "'marks' must be an array" }, { status: 400 });
  }

  const pass = body.pass;
  const feedbackRaw = typeof body.feedback === "string" ? body.feedback.trim() : null;
  const feedback = feedbackRaw !== null && feedbackRaw.length > 0 ? feedbackRaw : null;

  // Build a lookup of FREE_TEXT questions for the assigned variant (the only ones markers may touch).
  const freeTextById = new Map(
    variantQuestions
      .filter((q) => q.questionType === "FREE_TEXT")
      .map((q) => [q.id, q]),
  );

  // Validate each mark entry.
  type MarkEntry = { questionId: string; awardedMarks: number };
  const marksInput: MarkEntry[] = [];
  for (const item of body.marks) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).questionId !== "string" ||
      typeof (item as Record<string, unknown>).awardedMarks !== "number"
    ) {
      return NextResponse.json(
        { error: "Each mark entry must have { questionId: string, awardedMarks: number }" },
        { status: 400 },
      );
    }
    const entry = item as MarkEntry;
    const q = freeTextById.get(entry.questionId);
    if (!q) {
      // Not a FREE_TEXT question for this lesson — reject (MC is auto-scored).
      return NextResponse.json(
        {
          error: `questionId ${entry.questionId} is not a free-text question for this assessment`,
        },
        { status: 400 },
      );
    }
    if (
      !Number.isFinite(entry.awardedMarks) ||
      entry.awardedMarks < 0 ||
      entry.awardedMarks > q.maxMarks
    ) {
      return NextResponse.json(
        {
          error: `awardedMarks for question ${entry.questionId} must be between 0 and ${q.maxMarks}`,
        },
        { status: 400 },
      );
    }
    marksInput.push(entry);
  }

  const now = new Date();

  // Persist each free-text awardedMarks. Upsert so that blank answers
  // (where no AssessmentAnswer row exists) still get the mark recorded.
  await Promise.all(
    marksInput.map((m) =>
      prisma.assessmentAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId,
            questionId: m.questionId,
          },
        },
        update: { awardedMarks: m.awardedMarks },
        create: {
          submissionId,
          questionId: m.questionId,
          responseText: null,
          selectedOptionId: null,
          awardedMarks: m.awardedMarks,
        },
      }),
    ),
  );

  const manualScore = marksInput.reduce((sum, m) => sum + m.awardedMarks, 0);
  const totalScore = submission.autoScore + manualScore;
  const finalStatus = pass ? ("MARKED_PASS" as const) : ("MARKED_FAIL" as const);

  // Update the submission with the final mark.
  await prisma.assessmentSubmission.update({
    where: { id: submissionId },
    data: {
      status: finalStatus,
      manualScore,
      totalScore,
      feedback,
      gradedById: userId,
      gradedAt: now,
    },
  });

  // ON PASS — fire student lesson + course completion side-effects.
  if (pass) {
    const studentId = submission.userId;

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
    });

    if (enrollment && enrollment.completedAt == null) {
      // Race-safe LessonProgress upsert (mirrors lesson complete route).
      // Try CREATE first; if the unique constraint fires, fall back to a
      // conditional UPDATE (WHERE completedAt: null). Exactly one writer wins.
      try {
        await prisma.lessonProgress.create({
          data: {
            userId: studentId,
            lessonId,
            startedAt: now,
            completedAt: now,
          },
        });
      } catch (err: unknown) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          await prisma.lessonProgress.updateMany({
            where: { userId: studentId, lessonId, completedAt: null },
            data: { completedAt: now },
          });
        } else {
          throw err;
        }
      }

      // Award assessment XP to the student (25 XP mirrors quiz pass).
      await awardXp(studentId, 25);

      // Fire course-completion side-effects (idempotent via conditional stamp).
      await maybeCompleteCourse(studentId, courseId, enrollment, now);
    }

    trackEvent(studentId, "assessment_marked", {
      courseId,
      lessonId,
      passed: true,
      totalScore,
    });
  } else {
    // ON FAIL — mark released, student may retake.
    trackEvent(submission.userId, "assessment_marked", {
      courseId,
      lessonId,
      passed: false,
      totalScore,
    });
  }

  return NextResponse.json({ status: finalStatus, totalScore, manualScore });
}
