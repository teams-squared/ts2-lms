"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

interface QuizOption {
  id: string;
  text: string;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  order: number;
  options: QuizOption[];
}

interface BestAttempt {
  id: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  createdAt: string;
}

interface AnswerResult {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  correct: boolean;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  answers: AnswerResult[];
}

interface QuizViewerProps {
  questions: QuizQuestion[];
  passingScore: number;
  initialBestAttempt: BestAttempt | null;
  courseId: string;
  moduleId: string;
  lessonId: string;
}

type State = "idle" | "taking" | "submitted";

export function QuizViewer({
  questions,
  passingScore,
  initialBestAttempt,
  courseId,
  moduleId,
  lessonId,
}: QuizViewerProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bestAttempt = result
    ? {
        id: "current",
        score: result.score,
        totalQuestions: result.totalQuestions,
        passed: result.passed,
        createdAt: new Date().toISOString(),
      }
    : initialBestAttempt;

  const handleStart = () => {
    setSelectedAnswers({});
    setResult(null);
    setError(null);
    setState("taking");
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setResult(null);
    setError(null);
    setState("taking");
  };

  const handleSelect = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => selectedAnswers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    try {
      const answers = Object.entries(selectedAnswers).map(
        ([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }),
      );

      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/quiz/attempt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to submit quiz");
        return;
      }

      const data = (await res.json()) as QuizResult;
      setResult(data);
      setState("submitted");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-8 text-center">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          No questions have been added to this quiz yet.
        </p>
      </div>
    );
  }

  // Idle state — show best attempt summary (if any) and start button
  if (state === "idle") {
    return (
      <div className="space-y-6">
        {bestAttempt?.passed && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-3">
            <span className="text-emerald-600 dark:text-emerald-400 text-base">✓</span>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              You passed this quiz.
            </p>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-gray-50 dark:bg-[#18181f] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Passing score: {passingScore}%
              </p>
            </div>
            {bestAttempt && (
              <div className="text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500">Best attempt</p>
                <p
                  className={`text-sm font-semibold ${
                    bestAttempt.passed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {bestAttempt.score}/{bestAttempt.totalQuestions} (
                  {Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100)}%)
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleStart}
            className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 transition-colors"
          >
            {bestAttempt ? "Retake Quiz" : "Start Quiz"}
          </button>
        </div>
      </div>
    );
  }

  // Taking state — show questions with radio buttons
  if (state === "taking") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {questions.length} question{questions.length !== 1 ? "s" : ""} · Passing: {passingScore}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {Object.keys(selectedAnswers).length}/{questions.length} answered
          </p>
        </div>

        {questions.map((question, idx) => (
          <div
            key={question.id}
            className="rounded-xl border border-gray-200 dark:border-[#3a3a48] p-5"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              {idx + 1}. {question.text}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selectedAnswers[question.id] === option.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                      : "border-gray-200 dark:border-[#3a3a48] hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={selectedAnswers[question.id] === option.id}
                    onChange={() => handleSelect(question.id, option.id)}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    {option.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 transition-colors"
        >
          {submitting ? <span className="inline-flex items-center gap-2"><Spinner size="sm" className="border-white border-t-transparent" /> Submitting…</span> : "Submit Quiz"}
        </button>
      </div>
    );
  }

  // Submitted state — show results
  const currentResult = result;
  if (!currentResult) return null;

  return (
    <div className="space-y-6">
      {/* Score banner */}
      <div
        className={`rounded-xl border p-6 text-center ${
          currentResult.passed
            ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <p
          className={`text-2xl font-bold mb-1 ${
            currentResult.passed
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {currentResult.percentage}%
        </p>
        <p
          className={`text-sm font-medium ${
            currentResult.passed
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {currentResult.passed ? "Passed!" : "Not passed"} — {currentResult.score}/
          {currentResult.totalQuestions} correct
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Passing score: {currentResult.passingScore}%
        </p>
      </div>

      {/* Answer review */}
      {questions.map((question, idx) => {
        const answerResult = currentResult.answers.find(
          (a) => a.questionId === question.id,
        );
        return (
          <div
            key={question.id}
            className="rounded-xl border border-gray-200 dark:border-[#3a3a48] p-5"
          >
            <div className="flex items-start gap-2 mb-3">
              <span
                className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  answerResult?.correct
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                }`}
              >
                {answerResult?.correct ? "Correct" : "Incorrect"}
              </span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {idx + 1}. {question.text}
              </p>
            </div>
            <div className="space-y-2">
              {question.options.map((option) => {
                const isSelected = answerResult?.selectedOptionId === option.id;
                const isCorrect = answerResult?.correctOptionId === option.id;
                let optionClass =
                  "border-gray-200 dark:border-[#3a3a48] text-gray-700 dark:text-gray-300";
                if (isCorrect) {
                  optionClass =
                    "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300";
                } else if (isSelected && !isCorrect) {
                  optionClass =
                    "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                }
                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${optionClass}`}
                  >
                    <span className="text-sm">{option.text}</span>
                    {isCorrect && (
                      <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Correct answer
                      </span>
                    )}
                    {isSelected && !isCorrect && (
                      <span className="ml-auto text-xs font-medium text-red-600 dark:text-red-400">
                        Your answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!currentResult.passed && (
        <button
          onClick={handleRetry}
          className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
