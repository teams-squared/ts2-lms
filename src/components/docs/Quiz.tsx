"use client";

import { useState } from "react";
import type { QuizDefinition, DocProgress } from "@/lib/types";

interface QuizProps {
  quiz: QuizDefinition;
  docKey: string;
  existingProgress: DocProgress | null;
}

export default function Quiz({ quiz, docKey, existingProgress }: QuizProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [passed, setPassed] = useState(
    existingProgress?.quizPassedAt !== null &&
      existingProgress?.quizPassedAt !== undefined
  );

  if (passed && existingProgress) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 px-5 py-4 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-600 dark:text-green-400 text-lg">&#10003;</span>
          <h3 className="text-base font-semibold text-green-800 dark:text-green-300">
            Quiz Passed
          </h3>
        </div>
        <p className="text-sm text-green-700 dark:text-green-400">
          You scored {Math.round((existingProgress.quizScore ?? 0) * 100)}% on{" "}
          {new Date(existingProgress.quizPassedAt!).toLocaleDateString()}.
        </p>
        <button
          onClick={() => {
            setPassed(false);
            setSubmitted(false);
            setAnswers({});
            setScore(null);
          }}
          className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
        >
          Retake quiz
        </button>
      </div>
    );
  }

  const handleSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    const correct = quiz.questions.filter(
      (q) => answers[q.id] === q.correctIndex
    ).length;
    const quizScore = correct / quiz.questions.length;
    setScore(quizScore);
    setSubmitted(true);

    const didPass = quizScore >= quiz.passingScore;

    setSaving(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docKey,
          update: {
            quizScore,
            quizPassedAt: didPass ? new Date().toISOString() : null,
            quizAttempts: (existingProgress?.quizAttempts ?? 0) + 1,
            completedAt: didPass
              ? existingProgress?.completedAt ?? new Date().toISOString()
              : existingProgress?.completedAt ?? null,
          },
        }),
      });
      if (didPass) setPassed(true);
    } catch (err) {
      console.error("Failed to save quiz progress:", err);
    } finally {
      setSaving(false);
    }
  };

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="mt-8 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] px-5 py-5 shadow-card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Knowledge Check
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Answer the following questions to complete this unit.
        {" "}Pass mark: {Math.round(quiz.passingScore * 100)}%.
      </p>

      <div className="space-y-5">
        {quiz.questions.map((q, qi) => {
          const selected = answers[q.id];
          const isCorrect = submitted && selected === q.correctIndex;
          const isWrong =
            submitted && selected !== undefined && selected !== q.correctIndex;

          return (
            <div key={q.id} className="space-y-2">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  let optionStyle =
                    "border-gray-200 dark:border-[#3a3a48] hover:border-brand-300 dark:hover:border-brand-600";
                  if (selected === oi && !submitted) {
                    optionStyle =
                      "border-brand-500 bg-brand-50 dark:bg-brand-950/20 dark:border-brand-500";
                  }
                  if (submitted && oi === q.correctIndex) {
                    optionStyle =
                      "border-green-500 bg-green-50 dark:bg-green-950/20 dark:border-green-500";
                  }
                  if (submitted && selected === oi && oi !== q.correctIndex) {
                    optionStyle =
                      "border-red-400 bg-red-50 dark:bg-red-950/20 dark:border-red-500";
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => handleSelect(q.id, oi)}
                      disabled={submitted}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${optionStyle} ${
                        submitted ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {opt}
                      </span>
                      {submitted && oi === q.correctIndex && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          &#10003;
                        </span>
                      )}
                      {submitted &&
                        selected === oi &&
                        oi !== q.correctIndex && (
                          <span className="ml-2 text-red-500">&#10007;</span>
                        )}
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (isCorrect || isWrong) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || saving}
          className="mt-5 w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Submit Quiz
        </button>
      ) : (
        <div
          className={`mt-5 rounded-lg px-4 py-3 text-sm font-medium ${
            score !== null && score >= quiz.passingScore
              ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50"
              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50"
          }`}
        >
          {score !== null && score >= quiz.passingScore ? (
            <span>
              &#10003; You passed! Score: {Math.round(score * 100)}%
            </span>
          ) : (
            <div>
              <span>
                Score: {Math.round((score ?? 0) * 100)}% — you need{" "}
                {Math.round(quiz.passingScore * 100)}% to pass.
              </span>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  setScore(null);
                }}
                className="block mt-1 text-xs underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
