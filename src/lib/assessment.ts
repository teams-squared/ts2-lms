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
 *  - Multiple-choice questions are auto-scored at submit; free-text AND
 *    multi-select (checkbox) questions are left unmarked (awardedMarks=null)
 *    for a human marker.
 */

/** Question shape returned to students — never includes `isCorrect`. */
export interface SanitizedAssessmentQuestion {
  id: string;
  text: string;
  order: number;
  questionType: "MULTIPLE_CHOICE" | "FREE_TEXT" | "MULTI_SELECT";
  maxMarks: number;
  options: { id: string; text: string; order: number }[];
}

/** A draft/saved answer as the student client needs it for rehydration. */
export interface SavedAssessmentAnswer {
  questionId: string;
  selectedOptionId: string | null;
  selectedOptionIds: string[];
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
      /** Questions of the variant this attempt was assigned. */
      questions: SanitizedAssessmentQuestion[];
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

/**
 * Map an incoming student answer to the persisted column shape for its
 * question type. Exactly one of the three answer channels is populated; the
 * others are cleared so switching answer never leaves stale data:
 *  - MULTIPLE_CHOICE → selectedOptionId
 *  - MULTI_SELECT    → selectedOptionIds[]
 *  - FREE_TEXT       → responseText
 * Shared by the autosave (PUT) and submit routes so they never drift.
 */
export function answerDataFor(
  questionType: "MULTIPLE_CHOICE" | "FREE_TEXT" | "MULTI_SELECT",
  ans: {
    selectedOptionId?: string | null;
    selectedOptionIds?: string[] | null;
    responseText?: string | null;
  },
): { selectedOptionId: string | null; selectedOptionIds: string[]; responseText: string | null } {
  if (questionType === "MULTIPLE_CHOICE") {
    return { selectedOptionId: ans.selectedOptionId ?? null, selectedOptionIds: [], responseText: null };
  }
  if (questionType === "MULTI_SELECT") {
    return { selectedOptionId: null, selectedOptionIds: ans.selectedOptionIds ?? [], responseText: null };
  }
  return { selectedOptionId: null, selectedOptionIds: [], responseText: ans.responseText ?? null };
}

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
      variant: {
        select: {
          questions: {
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
    (submission.variant?.questions ?? []).map((q) => [q.id, q]),
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
    const [answers, questions] = await Promise.all([
      prisma.assessmentAnswer.findMany({
        where: { submissionId: latest.id },
        select: { questionId: true, selectedOptionId: true, selectedOptionIds: true, responseText: true },
      }),
      latest.variantId ? loadSanitizedQuestionsForVariant(latest.variantId) : Promise.resolve([]),
    ]);
    return {
      phase: "in_progress",
      submissionId: latest.id,
      deadlineAt: latest.deadlineAt.toISOString(),
      serverNow: new Date().toISOString(),
      savedAnswers: answers,
      questions,
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
 * Load + sanitize one variant's questions for a student (strips `isCorrect`).
 * Privileged callers (authoring/marking) should query directly instead.
 */
export async function loadSanitizedQuestionsForVariant(
  variantId: string,
): Promise<SanitizedAssessmentQuestion[]> {
  const questions = await prisma.assessmentQuestion.findMany({
    where: { variantId },
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

/** Number of variants configured on an assessment lesson. */
export async function getVariantCount(lessonId: string): Promise<number> {
  return prisma.assessmentVariant.count({ where: { lessonId } });
}

/**
 * Choose which variant to administer for a new attempt: a random variant the
 * user has NOT yet faced; once every variant has been seen, fall back to a
 * fully-random pick (recycle). Returns null if the lesson has no variants.
 *
 * "Faced" = any prior submission of this lesson that recorded a variantId
 * (the reattempt lock means prior attempts are failed/marked, so this set is
 * exactly the variants already shown to the student).
 */
export async function pickVariantForUser(
  userId: string,
  lessonId: string,
): Promise<string | null> {
  const variants = await prisma.assessmentVariant.findMany({
    where: { lessonId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  if (variants.length === 0) return null;

  const faced = await prisma.assessmentSubmission.findMany({
    where: { userId, lessonId, variantId: { not: null } },
    select: { variantId: true },
    distinct: ["variantId"],
  });
  const facedSet = new Set(faced.map((f) => f.variantId));

  const unseen = variants.filter((v) => !facedSet.has(v.id));
  const pool = unseen.length > 0 ? unseen : variants;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
