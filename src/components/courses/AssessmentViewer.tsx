"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { CheckCircleIcon, AlertTriangleIcon, ClockIcon } from "@/components/icons";
import type { SanitizedAssessmentQuestion, AssessmentStudentState, SavedAssessmentAnswer } from "@/lib/assessment";

interface AssessmentConfig {
  timeLimitMinutes: number;
  passThreshold: number;
}

interface AssessmentViewerProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  config: AssessmentConfig | null;
  questions: SanitizedAssessmentQuestion[];
  initialState: AssessmentStudentState;
  courseLocked?: boolean;
  /** Admins / course managers: enables a read-only "preview as student" dry-run
   *  that renders the exam UI without creating a submission or touching the DB. */
  isPrivileged?: boolean;
}

type AnswerMap = Record<string, { selectedOptionId?: string | null; responseText?: string | null }>;

function answersFromSaved(saved: SavedAssessmentAnswer[]): AnswerMap {
  const m: AnswerMap = {};
  for (const a of saved) {
    m[a.questionId] = { selectedOptionId: a.selectedOptionId, responseText: a.responseText };
  }
  return m;
}

function answersToArray(map: AnswerMap): { questionId: string; selectedOptionId?: string | null; responseText?: string | null }[] {
  return Object.entries(map).map(([questionId, v]) => ({ questionId, ...v }));
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Phase = "startable" | "in_progress" | "awaiting_marking" | "marked";

/** One question card — multiple-choice radios or a free-text box. Shared by the
 *  live exam and the manager preview so both render identically. */
function QuestionCard({
  question,
  idx,
  answer,
  onChange,
}: {
  question: SanitizedAssessmentQuestion;
  idx: number;
  answer: { selectedOptionId?: string | null; responseText?: string | null } | undefined;
  onChange: (questionId: string, field: "selectedOptionId" | "responseText", value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {idx + 1}. {question.text}
        </p>
        <span className="shrink-0 text-xs text-foreground-subtle">
          {question.maxMarks} mark{question.maxMarks !== 1 ? "s" : ""}
        </span>
      </div>

      {question.questionType === "MULTIPLE_CHOICE" ? (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                answer?.selectedOptionId === option.id
                  ? "border-primary bg-primary-subtle"
                  : "border-border hover:bg-surface-muted"
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.id}
                checked={answer?.selectedOptionId === option.id}
                onChange={() => onChange(question.id, "selectedOptionId", option.id)}
                className="text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="flex-1 text-sm text-foreground">{option.text}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          rows={5}
          value={answer?.responseText ?? ""}
          onChange={(e) => onChange(question.id, "responseText", e.target.value)}
          placeholder="Write your answer here…"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-foreground-subtle"
        />
      )}
    </div>
  );
}

export function AssessmentViewer({
  courseId,
  moduleId,
  lessonId,
  config,
  questions,
  initialState,
  courseLocked = false,
  isPrivileged = false,
}: AssessmentViewerProps) {
  const router = useRouter();
  const apiBase = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/assessment`;

  // ── Phase state ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(initialState.phase);
  const [submissionId, setSubmissionId] = useState<string | null>(
    initialState.phase === "in_progress" ? initialState.submissionId : null,
  );
  // For in_progress rehydration
  const [deadlineAt, setDeadlineAt] = useState<number | null>(
    initialState.phase === "in_progress" ? Date.parse(initialState.deadlineAt) : null,
  );
  // Offset: server clock minus client clock at the moment we synced.
  // Positive means server is ahead. Used to make countdown server-trusted.
  const [serverOffset, setServerOffset] = useState<number>(
    initialState.phase === "in_progress"
      ? Date.parse(initialState.serverNow) - Date.now()
      : 0,
  );
  const [markedData, setMarkedData] = useState<{
    passed: boolean;
    totalScore: number | null;
    passThreshold: number;
    feedback: string | null;
    gradedAt: string | null;
  } | null>(
    initialState.phase === "marked"
      ? {
          passed: initialState.passed,
          totalScore: initialState.totalScore,
          passThreshold: initialState.passThreshold,
          feedback: initialState.feedback,
          gradedAt: initialState.gradedAt,
        }
      : null,
  );
  const [awaitingSubmittedAt, setAwaitingSubmittedAt] = useState<string | null>(
    initialState.phase === "awaiting_marking" ? initialState.submittedAt : null,
  );
  const [lastFeedback, setLastFeedback] = useState<string | null | undefined>(
    initialState.phase === "startable" ? initialState.lastFeedback : undefined,
  );

  // ── Answers ──────────────────────────────────────────────────────────────────
  const [answers, setAnswers] = useState<AnswerMap>(
    initialState.phase === "in_progress"
      ? answersFromSaved(initialState.savedAnswers)
      : {},
  );

  // ── Countdown ────────────────────────────────────────────────────────────────
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (initialState.phase !== "in_progress") return 0;
    const serverNowMs = Date.parse(initialState.serverNow);
    const dlMs = Date.parse(initialState.deadlineAt);
    return Math.max(0, dlMs - serverNowMs);
  });
  const [timerExpired, setTimerExpired] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // ── Manager preview (read-only dry-run; no API calls, no submission) ──────────
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<AnswerMap>({});
  const handlePreviewChange = (
    questionId: string,
    field: "selectedOptionId" | "responseText",
    value: string,
  ) => {
    setPreviewAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], [field]: value } }));
  };

  // ── Autosave infra ───────────────────────────────────────────────────────────
  const answersRef = useRef(answers);
  const submissionIdRef = useRef(submissionId);
  const phaseRef = useRef(phase);
  const submittingRef = useRef(submitting);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router_ref = useRef(router);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submissionIdRef.current = submissionId; }, [submissionId]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);
  useEffect(() => { router_ref.current = router; }, [router]);

  // ── Submit helper (used by manual submit, timer, and autosave 409 handler) ──
  const doSubmit = useCallback(async (currentAnswers: AnswerMap, currentSubId: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${apiBase}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: currentSubId, answers: answersToArray(currentAnswers) }),
      });
      if (res.ok) {
        setPhase("awaiting_marking");
        setAwaitingSubmittedAt(new Date().toISOString());
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setSubmitError(data.error ?? "Failed to submit. Please try again.");
      }
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [apiBase, router]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const doAutosave = useCallback(async () => {
    const subId = submissionIdRef.current;
    const ph = phaseRef.current;
    if (ph !== "in_progress" || !subId) return;
    try {
      const res = await fetch(`${apiBase}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: subId, answers: answersToArray(answersRef.current) }),
      });
      if (res.ok) {
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2000);
      } else if (res.status === 409) {
        const data = (await res.json()) as { error?: string };
        if (data.error === "expired") {
          // Timer expired server-side — force submit
          await doSubmit(answersRef.current, subId);
        }
      }
    } catch {
      // Silent — autosave failures are non-fatal
    }
  }, [apiBase, doSubmit]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { void doAutosave(); }, 10_000);
  }, [doAutosave]);

  // On answer change: schedule debounced autosave
  const handleAnswerChange = (questionId: string, field: "selectedOptionId" | "responseText", value: string | null) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: { ...prev[questionId], [field]: value } };
      answersRef.current = next;
      return next;
    });
    scheduleAutosave();
  };

  // Visibility-change autosave (mirrors PolicyDocViewer)
  useEffect(() => {
    if (phase !== "in_progress") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void doAutosave();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase, doAutosave]);

  // Unmount autosave
  useEffect(() => {
    return () => {
      if (phase === "in_progress" && submissionIdRef.current && !submittingRef.current) {
        void doAutosave();
      }
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "in_progress" || deadlineAt === null) return;

    const tick = () => {
      // Use server-synced offset so client drift doesn't matter
      const now = Date.now() + serverOffset;
      const rem = Math.max(0, deadlineAt - now);
      setRemainingMs(rem);
      if (rem <= 0 && !timerExpired) {
        setTimerExpired(true);
      }
    };

    tick(); // immediate
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phase, deadlineAt, serverOffset, timerExpired]);

  // Auto-submit when timer fires
  useEffect(() => {
    if (!timerExpired || phase !== "in_progress") return;
    const subId = submissionIdRef.current;
    if (!subId) return;
    void doSubmit(answersRef.current, subId);
  }, [timerExpired, phase, doSubmit]);

  // ── Start ────────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`${apiBase}/start`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStartError(data.error ?? "Could not start assessment. Please try again.");
        return;
      }
      const data = (await res.json()) as { submissionId: string; deadlineAt: string; serverNow: string };
      const offset = Date.parse(data.serverNow) - Date.now();
      setServerOffset(offset);
      setSubmissionId(data.submissionId);
      submissionIdRef.current = data.submissionId;
      setDeadlineAt(Date.parse(data.deadlineAt));
      setRemainingMs(Math.max(0, Date.parse(data.deadlineAt) - Date.parse(data.serverNow)));
      setTimerExpired(false);
      setAnswers({});
      setPhase("in_progress");
      setSubmitError(null);
    } catch {
      setStartError("An unexpected error occurred. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  // ── Manual submit ─────────────────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    const subId = submissionIdRef.current;
    if (!subId) return;
    await doSubmit(answersRef.current, subId);
  };

  // ── Retake (from marked phase) ────────────────────────────────────────────────
  const handleRetake = async () => {
    setLastFeedback(markedData?.feedback ?? null);
    setMarkedData(null);
    await handleStart();
  };

  // ── Render: manager preview (read-only dry-run, no persistence) ───────────────
  if (preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-info/60 bg-info-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 shrink-0 text-info" aria-hidden="true" />
            <p className="text-sm font-medium text-info">
              Preview — manager view. Nothing is saved and no attempt is created.
            </p>
          </div>
          <button
            onClick={() => setPreview(false)}
            className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Exit preview
          </button>
        </div>

        {config && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-5 py-3">
            <ClockIcon className="h-5 w-5 text-foreground-muted" aria-hidden="true" />
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatCountdown(config.timeLimitMinutes * 60_000)}
            </span>
            <span className="text-xs text-foreground-muted">time limit — not running in preview</span>
          </div>
        )}

        {questions.map((question, idx) => (
          <QuestionCard
            key={question.id}
            question={question}
            idx={idx}
            answer={previewAnswers[question.id]}
            onChange={handlePreviewChange}
          />
        ))}

        <button
          disabled
          className="w-full cursor-not-allowed rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground opacity-50"
        >
          Submit assessment (disabled in preview)
        </button>
      </div>
    );
  }

  // ── Render: startable ─────────────────────────────────────────────────────────
  if (phase === "startable") {
    const hasConfig = config !== null;
    return (
      <div className="space-y-6">
        {lastFeedback && (
          <div className="rounded-lg border border-info/60 bg-info-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-info mb-1">
              Marker feedback from previous attempt
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{lastFeedback}</p>
          </div>
        )}
        <div className="rounded-lg border border-border bg-surface-muted p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground mb-2">Assessment overview</p>
            <div className="space-y-1">
              <p className="text-sm text-foreground-muted">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
                {questions.some((q) => q.questionType === "MULTIPLE_CHOICE") &&
                  questions.some((q) => q.questionType === "FREE_TEXT")
                  ? " (multiple-choice + written)"
                  : questions.every((q) => q.questionType === "MULTIPLE_CHOICE")
                    ? " (multiple-choice)"
                    : " (written)"}
              </p>
              {hasConfig && (
                <>
                  <p className="text-sm text-foreground-muted">
                    Time limit: {config.timeLimitMinutes} minute{config.timeLimitMinutes !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Pass threshold: {config.passThreshold} mark{config.passThreshold !== 1 ? "s" : ""}
                  </p>
                </>
              )}
              {questions.length > 0 && (
                <p className="text-sm text-foreground-muted">
                  Total available marks: {questions.reduce((s, q) => s + q.maxMarks, 0)}
                </p>
              )}
            </div>
          </div>
          {!hasConfig && (
            <p className="mb-4 text-sm text-warning rounded-md border border-warning/40 bg-warning-subtle px-3 py-2">
              This assessment has not been configured yet. An admin must set the time limit and
              pass threshold before it can be taken.
            </p>
          )}
          {startError && (
            <p className="mb-3 flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {startError}
            </p>
          )}
          <button
            onClick={() => void handleStart()}
            disabled={!hasConfig || courseLocked || questions.length === 0 || starting}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {starting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" className="border-primary-foreground border-t-transparent" />
                Starting…
              </span>
            ) : courseLocked ? (
              "Course completed — assessment locked"
            ) : lastFeedback != null ? (
              "Retake assessment"
            ) : (
              "Start assessment"
            )}
          </button>
          {isPrivileged && questions.length > 0 && (
            <button
              onClick={() => setPreview(true)}
              className="mt-2 w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Preview as student
            </button>
          )}
          {isPrivileged && (
            <p className="mt-2 text-center text-xs text-foreground-subtle">
              Preview renders the exam exactly as students see it, without creating a submission.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Render: in_progress ───────────────────────────────────────────────────────
  if (phase === "in_progress") {
    const urgentCountdown = remainingMs < 5 * 60 * 1000; // < 5 min = orange/red
    const criticalCountdown = remainingMs < 60 * 1000;    // < 1 min = red

    return (
      <div className="space-y-6">
        {/* Sticky countdown bar */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between gap-4 rounded-lg border px-5 py-3 ${
            criticalCountdown
              ? "border-danger/60 bg-danger-subtle"
              : urgentCountdown
                ? "border-warning/60 bg-warning-subtle"
                : "border-border bg-surface-muted"
          }`}
        >
          <div className="flex items-center gap-2">
            <ClockIcon
              className={`h-5 w-5 ${
                criticalCountdown ? "text-danger" : urgentCountdown ? "text-warning" : "text-foreground-muted"
              }`}
              aria-hidden="true"
            />
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                criticalCountdown ? "text-danger" : urgentCountdown ? "text-warning" : "text-foreground"
              }`}
              aria-label={`Time remaining: ${formatCountdown(remainingMs)}`}
            >
              {formatCountdown(remainingMs)}
            </span>
            <span className="text-xs text-foreground-muted hidden sm:inline">remaining</span>
          </div>
          <div className="flex items-center gap-3">
            {savedIndicator && (
              <span className="text-xs text-success flex items-center gap-1">
                <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Saved
              </span>
            )}
            <span className="text-xs text-foreground-muted">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
          </div>
        </div>

        {/* Questions */}
        {questions.map((question, idx) => (
          <QuestionCard
            key={question.id}
            question={question}
            idx={idx}
            answer={answers[question.id]}
            onChange={handleAnswerChange}
          />
        ))}

        {submitError && (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {submitError}
          </p>
        )}

        <button
          onClick={() => void handleManualSubmit()}
          disabled={submitting || timerExpired}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" className="border-primary-foreground border-t-transparent" />
              Submitting…
            </span>
          ) : (
            "Submit assessment"
          )}
        </button>
        <p className="text-center text-xs text-foreground-subtle">
          Your answers are saved automatically every 10 seconds and when you switch tabs.
        </p>
      </div>
    );
  }

  // ── Render: awaiting_marking ──────────────────────────────────────────────────
  if (phase === "awaiting_marking") {
    return (
      <div className="rounded-lg border border-info/60 bg-info-subtle p-8 text-center">
        <CheckCircleIcon className="mx-auto mb-3 h-10 w-10 text-info" aria-hidden="true" />
        <p className="text-base font-semibold text-info">Submitted — awaiting marking</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Your assessment has been submitted
          {awaitingSubmittedAt
            ? ` on ${new Date(awaitingSubmittedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""}
          . A marker will review your answers and provide feedback.
        </p>
      </div>
    );
  }

  // ── Render: marked ────────────────────────────────────────────────────────────
  const md = markedData;
  if (!md) return null;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-6 text-center ${
          md.passed ? "border-success/60 bg-success-subtle" : "border-danger/60 bg-danger-subtle"
        }`}
      >
        <p className={`mb-1 text-2xl font-bold ${md.passed ? "text-success" : "text-danger"}`}>
          {md.passed ? "Passed" : "Not passed"}
        </p>
        <p className={`text-sm font-medium ${md.passed ? "text-success" : "text-danger"}`}>
          Score: {md.totalScore ?? "—"} / {md.passThreshold} required to pass
        </p>
        {md.gradedAt && (
          <p className="mt-1 text-xs text-foreground-muted">
            Marked on{" "}
            {new Date(md.gradedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {md.feedback && (
        <div className="rounded-lg border border-border bg-surface-muted p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-2">
            Marker feedback
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{md.feedback}</p>
        </div>
      )}

      {!md.passed && !courseLocked && (
        <button
          onClick={() => void handleRetake()}
          disabled={starting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {starting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" className="border-primary-foreground border-t-transparent" />
              Starting…
            </span>
          ) : (
            "Retake assessment"
          )}
        </button>
      )}
      {startError && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {startError}
        </p>
      )}
    </div>
  );
}
