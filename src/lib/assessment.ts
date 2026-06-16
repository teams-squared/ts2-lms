import type { AssessmentSubmission, AssessmentSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Assessment lesson type — server-side helpers shared by the student API
 * routes (start / answers / submit / GET) and the marking routes.
 *
 * Core invariants enforced here:
 *  - The timer is server-trusted: `deadlineAt` is stamped at start and is the
 *    only source of truth. Clients get `serverNow` for display-only countdown.
 *  - At most one "open" submission per (user, lesson) — IN_PROGRESS or
 *    SUBMITTED (awaiting marking). The DB partial unique index is the hard
 *    guarantee; helpers here surface friendly results.
 *  - Multiple-choice questions are auto-scored at submit; free-text questions
 *    are left unmarked (awardedMarks=null) for a human marker.
 */

/** Question shape returned to students — never includes `isCorrect`. */
export interface SanitizedAssessmentQuestion {
  id: string;
  text: string;
  order: number;
  questionType: "MULTIPLE_CHOICE" | "FREE_TEXT";
  maxMarks: number;
  options: { id: string; text: string; order: number }[];
}

/** A draft/saved answer as the student client needs it for rehydration. */
export interface SavedAssessmentAnswer {
  questionId: string;
  selectedOptionId: string | null;
  responseText: string | null;
}

/** Student-facing view of where the caller stands on this assessment. */
export type AssessmentStudentState =
  | { phase: "startable"; lastFeedback?: string | null }
  | {
      phase: "in_progress";
      submissionId: string;
      deadlineAt: string;
      serverNow: string;
      savedAnswers: SavedAssessmentAnswer[];
    }
  | { phase: "awaiting_marking"; submittedAt: string | null }
  | {
      phase: "marked";
      passed: boolean;
      totalScore: number | null;
      passThreshold: number;
      feedback: string | null;
      gradedAt: string | null;
    };

/** Statuses that occupy the single "open submission" slot (the reattempt lock). */
const OPEN_STATUSES: AssessmentSubmissionStatus[] = ["IN_PROGRESS", "SUBMITTED"];

/**
 * The submission currently occupying the open slot for (user, lesson), if any.
 * IN_PROGRESS = exam in flight; SUBMITTED = awaiting marking. Either blocks a
 * new attempt.
 */
export async function findOpenSubmission(
  userId: string,
  lessonId: string,
): Promise<AssessmentSubmission | null> {
  return prisma.assessmentSubmission.findFirst({
    where: { userId, lessonId, status: { in: OPEN_STATUSES } },
    orderBy: { startedAt: "desc" },
  });
}

/** The most recent submission overall (any status) — drives "startable vs marked" UI. */
export async function findLatestSubmission(
  userId: string,
  lessonId: string,
): Promise<AssessmentSubmission | null> {
  return prisma.assessmentSubmission.findFirst({
    where: { userId, lessonId },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Finalize a submission: score its multiple-choice answers, stamp the MC
 * `awardedMarks` per answer, set `autoScore`, and flip IN_PROGRESS → SUBMITTED.
 *
 * Race-/idempotency-safe: the status flip is a conditional `updateMany`
 * (WHERE status=IN_PROGRESS), so a manual submit racing the auto-submit timer
 * only finalizes once. Returns the up-to-date submission either way.
 *
 * Free-text answers are left with `awardedMarks=null` — a human marks them.
 */
export async function finalizeSubmission(
  submissionId: string,
  opts: { autoSubmitted: boolean; now?: Date },
): Promise<AssessmentSubmission> {
  const now = opts.now ?? new Date();

  const submission = await prisma.assessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      answers: true,
      lesson: {
        select: {
          assessmentQuestions: {
            select: {
              id: true,
              questionType: true,
              maxMarks: true,
              options: { select: { id: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });
  if (!submission) throw new Error(`Assessment submission ${submissionId} not found`);

  // Already finalized — nothing to do (auto-submit raced a manual submit).
  if (submission.status !== "IN_PROGRESS") return submission;

  const questionById = new Map(
    submission.lesson.assessmentQuestions.map((q) => [q.id, q]),
  );

  // Score MC answers; collect per-answer awardedMarks for the MC ones.
  let autoScore = 0;
  const mcUpdates: { id: string; awardedMarks: number }[] = [];
  for (const ans of submission.answers) {
    const q = questionById.get(ans.questionId);
    if (!q || q.questionType !== "MULTIPLE_CHOICE") continue;
    const correctOption = q.options.find((o) => o.isCorrect);
    const awarded =
      correctOption && ans.selectedOptionId === correctOption.id ? q.maxMarks : 0;
    autoScore += awarded;
    mcUpdates.push({ id: ans.id, awardedMarks: awarded });
  }

  // Persist atomically-ish: flip status only if still IN_PROGRESS (race guard),
  // then stamp per-answer MC marks. If the guard loses the race, bail and
  // return the now-finalized row.
  const flip = await prisma.assessmentSubmission.updateMany({
    where: { id: submissionId, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      autoSubmitted: opts.autoSubmitted,
      autoScore,
    },
  });
  if (flip.count !== 1) {
    const fresh = await prisma.assessmentSubmission.findUnique({ where: { id: submissionId } });
    return fresh ?? submission;
  }

  await Promise.all(
    mcUpdates.map((u) =>
      prisma.assessmentAnswer.update({
        where: { id: u.id },
        data: { awardedMarks: u.awardedMarks },
      }),
    ),
  );

  const updated = await prisma.assessmentSubmission.findUnique({ where: { id: submissionId } });
  return updated ?? submission;
}

/**
 * If the given submission is IN_PROGRESS and past its deadline, finalize it as
 * an auto-submit. No-op otherwise. Lets any read path (student GET, marking
 * queue) lazily catch submissions abandoned by a hard tab-close where the
 * client countdown never fired the submit.
 */
export async function finalizeIfExpired(
  submission: Pick<AssessmentSubmission, "id" | "status" | "deadlineAt">,
  now: Date = new Date(),
): Promise<void> {
  if (submission.status === "IN_PROGRESS" && now > submission.deadlineAt) {
    await finalizeSubmission(submission.id, { autoSubmitted: true, now });
  }
}

/**
 * Build the student-facing state for the assessment lesson page. Lazily
 * finalizes an expired in-progress attempt first so a reload after the
 * deadline shows the correct "awaiting marking" phase.
 */
export async function getStudentState(
  userId: string,
  lessonId: string,
): Promise<AssessmentStudentState> {
  const open = await findOpenSubmission(userId, lessonId);
  if (open) {
    await finalizeIfExpired(open);
  }

  const latest = await findLatestSubmission(userId, lessonId);
  if (!latest) return { phase: "startable" };

  if (latest.status === "IN_PROGRESS") {
    const answers = await prisma.assessmentAnswer.findMany({
      where: { submissionId: latest.id },
      select: { questionId: true, selectedOptionId: true, responseText: true },
    });
    return {
      phase: "in_progress",
      submissionId: latest.id,
      deadlineAt: latest.deadlineAt.toISOString(),
      serverNow: new Date().toISOString(),
      savedAnswers: answers,
    };
  }

  if (latest.status === "SUBMITTED") {
    return { phase: "awaiting_marking", submittedAt: latest.submittedAt?.toISOString() ?? null };
  }

  if (latest.status === "MARKED_PASS" || latest.status === "MARKED_FAIL") {
    return {
      phase: "marked",
      passed: latest.status === "MARKED_PASS",
      totalScore: latest.totalScore,
      passThreshold: latest.passThreshold,
      feedback: latest.feedback,
      gradedAt: latest.gradedAt?.toISOString() ?? null,
    };
  }

  return { phase: "startable" };
}

/**
 * Load + sanitize the assessment's questions for a student (strips `isCorrect`).
 * Privileged callers (authoring/marking) should query directly instead.
 */
export async function loadSanitizedQuestions(
  lessonId: string,
): Promise<SanitizedAssessmentQuestion[]> {
  const questions = await prisma.assessmentQuestion.findMany({
    where: { lessonId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    questionType: q.questionType,
    maxMarks: q.maxMarks,
    options: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
  }));
}
