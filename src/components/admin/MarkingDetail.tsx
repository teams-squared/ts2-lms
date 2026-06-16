"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useToast } from "@/components/ui/ToastProvider";
import { useMutationPulse } from "@/hooks/useMutationPulse";
import { cn } from "@/lib/utils";

// ── API response types ───────────────────────────────────────────────────────

interface AnswerData {
  selectedOptionId: string | null;
  responseText: string | null;
  awardedMarks: number | null;
}

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionData {
  id: string;
  text: string;
  order: number;
  questionType: "MULTIPLE_CHOICE" | "FREE_TEXT";
  maxMarks: number;
  options: QuestionOption[];
  answer: AnswerData | null;
}

interface SubmissionData {
  id: string;
  status: string;
  autoScore: number;
  manualScore: number | null;
  totalScore: number | null;
  passThreshold: number;
  feedback: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  gradedAt: string | null;
}

interface MarkingDetailResponse {
  submission: SubmissionData;
  student: { name: string; email: string; avatar: string | null };
  course: { id: string; title: string };
  module: { title: string };
  lesson: { id: string; title: string };
  questions: QuestionData[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString: string | null): string {
  if (!isoString) return "Unknown";
  return new Date(isoString).toLocaleString();
}

function isAlreadyMarked(status: string): boolean {
  return status === "MARKED_PASS" || status === "MARKED_FAIL";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarkingDetail({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { pulse, pulseClass } = useMutationPulse();

  const [data, setData] = useState<MarkingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Free-text marks keyed by questionId
  const [freeTextMarks, setFreeTextMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [pass, setPass] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/marking/${submissionId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load (${res.status})`);
      }
      const json = (await res.json()) as MarkingDetailResponse;
      setData(json);

      // Initialise free-text marks from existing answers (re-open scenario)
      const initMarks: Record<string, string> = {};
      for (const q of json.questions) {
        if (q.questionType === "FREE_TEXT") {
          initMarks[q.id] =
            q.answer?.awardedMarks != null
              ? String(q.answer.awardedMarks)
              : "";
        }
      }
      setFreeTextMarks(initMarks);

      // Initialise feedback
      setFeedback(json.submission.feedback ?? "");

      // Default pass based on projected total vs threshold
      const autoScore = json.submission.autoScore;
      const ftTotal = Object.values(initMarks).reduce((acc, v) => {
        const n = parseFloat(v);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);
      setPass(autoScore + ftTotal >= json.submission.passThreshold);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const freeTextQuestions =
    data?.questions.filter((q) => q.questionType === "FREE_TEXT") ?? [];

  const currentFtTotal = freeTextQuestions.reduce((acc, q) => {
    const v = freeTextMarks[q.id] ?? "";
    const n = parseFloat(v);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  const projectedTotal = (data?.submission.autoScore ?? 0) + currentFtTotal;

  // Is every free-text mark filled and in range?
  const freeTextValid = freeTextQuestions.every((q) => {
    const v = freeTextMarks[q.id] ?? "";
    if (v === "") return false;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= q.maxMarks;
  });

  const alreadyMarked = data ? isAlreadyMarked(data.submission.status) : false;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleMarkChange(questionId: string, value: string) {
    setFreeTextMarks((prev) => ({ ...prev, [questionId]: value }));
    // Re-compute pass default when marks change
    if (data) {
      const newFtTotal = freeTextQuestions.reduce((acc, q) => {
        const v = q.id === questionId ? value : (freeTextMarks[q.id] ?? "");
        const n = parseFloat(v);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);
      setPass(data.submission.autoScore + newFtTotal >= data.submission.passThreshold);
    }
  }

  async function handleSubmit() {
    if (!data || submitting || !freeTextValid) return;

    const marks = freeTextQuestions.map((q) => ({
      questionId: q.id,
      awardedMarks: Number(freeTextMarks[q.id] ?? 0),
    }));

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/marking/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks,
          feedback: feedback.trim() || undefined,
          pass,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        totalScore?: number;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Submission failed (${res.status})`);
      }
      pulse(submissionId);
      toast(
        `Marked as ${pass ? "Pass" : "Fail"}. Total score: ${body.totalScore ?? projectedTotal}.`,
        "success",
      );
      router.push("/admin/marking");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to submit marks",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-sm text-foreground-muted animate-pulse">Loading submission…</div>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center">
        <p className="text-sm font-medium text-danger mb-2">
          {fetchError ?? "Submission not found."}
        </p>
        <Link
          href="/admin/marking"
          className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
        >
          Back to marking queue
        </Link>
      </div>
    );
  }

  const { submission, student, course, module: mod, lesson, questions } = data;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/marking"
        className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
      >
        ← Back to marking queue
      </Link>

      {/* Header card */}
      <div className="rounded-lg border border-border bg-surface shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <UserAvatar name={student.name} image={student.avatar} size="lg" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-base font-semibold text-foreground">{student.name}</p>
            <p className="text-sm text-foreground-muted">{student.email}</p>
            <p className="text-xs text-foreground-subtle mt-1">
              {course.title} › {mod.title} › {lesson.title}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-start sm:items-end shrink-0">
            <div className="text-xs text-foreground-muted">
              Submitted: {formatDate(submission.submittedAt)}
            </div>
            {submission.autoSubmitted && (
              <span className="inline-flex items-center rounded-full bg-surface-muted border border-border px-2 py-0.5 text-xs font-medium text-foreground-muted">
                Auto-submitted
              </span>
            )}
            {alreadyMarked && (
              <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                {submission.status === "MARKED_PASS" ? "Passed" : "Failed"} — already marked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Already-marked read-only banner */}
      {alreadyMarked && (
        <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground-muted">
          This submission has already been graded (
          {formatDate(submission.gradedAt)}) and cannot be re-marked. Total
          score: {submission.totalScore ?? "—"} / pass threshold:{" "}
          {submission.passThreshold}.
          {submission.feedback && (
            <p className="mt-2 italic text-foreground-subtle">
              Feedback: &ldquo;{submission.feedback}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              freeTextMark={freeTextMarks[question.id] ?? ""}
              onMarkChange={(v) => handleMarkChange(question.id, v)}
              readOnly={alreadyMarked}
            />
          ))}
      </div>

      {/* Scoring summary */}
      <div className="rounded-lg border border-border bg-surface shadow-sm p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Score summary</h3>
        <div className="text-sm text-foreground-muted space-y-1">
          <div className="flex justify-between">
            <span>Multiple-choice (auto)</span>
            <span className="tabular-nums font-medium text-foreground">
              {submission.autoScore}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Free-text (manual)</span>
            <span className="tabular-nums font-medium text-foreground">
              {currentFtTotal}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-foreground font-semibold">
            <span>Projected total</span>
            <span
              className={cn(
                "tabular-nums",
                projectedTotal >= submission.passThreshold
                  ? "text-success"
                  : "text-danger",
              )}
            >
              {projectedTotal} / {submission.passThreshold} to pass
            </span>
          </div>
        </div>
        <p className="text-xs text-foreground-subtle">
          {projectedTotal >= submission.passThreshold
            ? "≥ threshold — on track to pass."
            : "< threshold — on track to fail."}
        </p>
      </div>

      {/* Feedback + pass/fail + submit — hidden if already marked */}
      {!alreadyMarked && (
        <div className="rounded-lg border border-border bg-surface shadow-sm p-4 space-y-4">
          <div>
            <label
              htmlFor="marking-feedback"
              className="block text-xs font-medium text-foreground-muted mb-1"
            >
              Feedback (optional)
            </label>
            <textarea
              id="marking-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Enter feedback for the student…"
              className="w-full text-sm rounded-md border border-border bg-surface px-3 py-2 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
            />
          </div>

          {/* Pass / Fail toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground-muted">
              Outcome:
            </span>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setPass(true)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
                  pass
                    ? "bg-success text-success-foreground"
                    : "bg-surface text-foreground-muted hover:bg-surface-muted",
                )}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => setPass(false)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset border-l border-border",
                  !pass
                    ? "bg-danger text-danger-foreground"
                    : "bg-surface text-foreground-muted hover:bg-surface-muted",
                )}
              >
                Fail
              </button>
            </div>
            <span className="text-xs text-foreground-subtle">
              Override auto-threshold if needed.
            </span>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !freeTextValid}
              className={cn(
                "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                pulseClass(submissionId),
              )}
            >
              {submitting ? "Submitting…" : "Submit marks"}
            </button>
            {!freeTextValid && freeTextQuestions.length > 0 && (
              <p className="text-xs text-foreground-muted">
                Enter valid marks for all free-text questions to submit.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  freeTextMark,
  onMarkChange,
  readOnly,
}: {
  question: QuestionData;
  freeTextMark: string;
  onMarkChange: (v: string) => void;
  readOnly: boolean;
}) {
  const mark = parseFloat(freeTextMark);
  const markInvalid =
    question.questionType === "FREE_TEXT" &&
    !readOnly &&
    freeTextMark !== "" &&
    (isNaN(mark) || !Number.isInteger(mark) || mark < 0 || mark > question.maxMarks);

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm p-4 space-y-3">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <span className="text-xs font-medium text-foreground-subtle uppercase tracking-wide">
            Q{question.order} ·{" "}
            {question.questionType === "MULTIPLE_CHOICE"
              ? "Multiple choice"
              : "Free text"}
          </span>
          <p className="mt-0.5 text-sm text-foreground font-medium">
            {question.text}
          </p>
        </div>
        <span className="text-xs text-foreground-muted shrink-0">
          {question.maxMarks} mark{question.maxMarks === 1 ? "" : "s"}
        </span>
      </div>

      {/* MC options */}
      {question.questionType === "MULTIPLE_CHOICE" && (
        <div className="space-y-1.5">
          {question.options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((opt) => {
              const isSelected = question.answer?.selectedOptionId === opt.id;
              const isCorrect = opt.isCorrect;
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                    isCorrect && isSelected
                      ? "border-success bg-success-subtle text-success"
                      : isCorrect
                        ? "border-success/40 bg-success-subtle/40 text-success"
                        : isSelected
                          ? "border-danger bg-danger-subtle text-danger"
                          : "border-border bg-surface text-foreground-muted",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected ? "border-current" : "border-border",
                    )}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {isCorrect && (
                    <span className="text-xs font-medium text-success ml-auto">
                      Correct
                    </span>
                  )}
                </div>
              );
            })}
          <div className="mt-2 text-xs text-foreground-muted">
            Auto-awarded:{" "}
            <span className="font-medium text-foreground">
              {question.answer?.awardedMarks ?? 0} / {question.maxMarks}
            </span>
          </div>
        </div>
      )}

      {/* Free-text answer + mark input */}
      {question.questionType === "FREE_TEXT" && (
        <div className="space-y-3">
          {/* Student's answer */}
          <div>
            <p className="text-xs font-medium text-foreground-muted mb-1">
              Student answer
            </p>
            <div className="rounded-md border border-border bg-surface-muted/50 px-3 py-2 text-sm text-foreground whitespace-pre-wrap min-h-[3rem]">
              {question.answer?.responseText?.trim() ? (
                question.answer.responseText
              ) : (
                <span className="text-foreground-subtle italic">No answer provided.</span>
              )}
            </div>
          </div>

          {/* Mark input */}
          <div className="flex items-center gap-3">
            <label
              htmlFor={`mark-${question.id}`}
              className="text-xs font-medium text-foreground-muted whitespace-nowrap"
            >
              Awarded marks
            </label>
            {readOnly ? (
              <span className="text-sm font-medium text-foreground">
                {question.answer?.awardedMarks ?? "—"} / {question.maxMarks}
              </span>
            ) : (
              <>
                <input
                  id={`mark-${question.id}`}
                  type="number"
                  min={0}
                  max={question.maxMarks}
                  step={1}
                  value={freeTextMark}
                  onChange={(e) => onMarkChange(e.target.value)}
                  className={cn(
                    "w-20 rounded-md border px-2 py-1 text-sm text-foreground text-center",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    markInvalid
                      ? "border-danger bg-danger-subtle/30"
                      : "border-border bg-surface",
                  )}
                  placeholder="0"
                />
                <span className="text-xs text-foreground-muted">
                  / {question.maxMarks}
                </span>
                {markInvalid && (
                  <span className="text-xs text-danger">
                    Must be integer 0–{question.maxMarks}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
