"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  order: number;
  options: QuizOption[];
}

interface QuizBuilderProps {
  initialQuestions: QuizQuestion[];
  passingScore: number;
  courseId: string;
  moduleId: string;
  lessonId: string;
}

interface NewOption {
  text: string;
  isCorrect: boolean;
}

const EMPTY_OPTIONS: NewOption[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuizBuilder({
  initialQuestions,
  passingScore,
  courseId,
  moduleId,
  lessonId,
}: QuizBuilderProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [showForm, setShowForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<NewOption[]>(EMPTY_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiBase = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/quiz/questions`;

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, { text: "", isCorrect: false }]);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleOptionText = (idx: number, text: string) => {
    setOptions(options.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleCorrectChange = (idx: number) => {
    setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!questionText.trim()) {
      setError("Question text is required");
      return;
    }
    if (options.some((o) => !o.text.trim())) {
      setError("All options must have text");
      return;
    }
    if (!options.some((o) => o.isCorrect)) {
      setError("Mark one option as correct");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: questionText, options }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to add question");
        return;
      }

      const created = (await res.json()) as QuizQuestion;
      setQuestions([...questions, created]);
      setQuestionText("");
      setOptions(EMPTY_OPTIONS);
      setShowForm(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    setDeletingId(questionId);
    try {
      const res = await fetch(`${apiBase}/${questionId}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-[#2e2e3a]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Quiz Builder
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Passing score: {passingScore}%
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 transition-colors"
          >
            Add question
          </button>
        )}
      </div>

      {/* Existing questions */}
      {questions.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No questions yet. Add one above.
        </p>
      )}

      <div className="space-y-3 mb-4">
        {questions.map((question, idx) => (
          <div
            key={question.id}
            className="rounded-xl border border-gray-200 dark:border-[#3a3a48] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {idx + 1}. {question.text}
              </p>
              <button
                onClick={() => handleDelete(question.id)}
                disabled={deletingId === question.id}
                aria-label={`Delete question ${idx + 1}`}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingId === question.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {question.options.map((opt) => (
                <li key={opt.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      opt.isCorrect
                        ? "bg-emerald-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                  {opt.text}
                  {opt.isCorrect && (
                    <span className="text-emerald-600 dark:text-emerald-400">(correct)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Add question form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/30 dark:bg-indigo-900/10 p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Question text
            </label>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter your question…"
              className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Options (mark one as correct)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() => handleCorrectChange(idx)}
                    title={`Mark option ${idx + 1} as correct`}
                    className="text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      aria-label={`Remove option ${idx + 1}`}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 4 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + Add option
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {submitting ? "Adding…" : "Add question"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setQuestionText("");
                setOptions(EMPTY_OPTIONS);
              }}
              className="rounded-lg border border-gray-300 dark:border-[#3a3a48] text-sm text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
