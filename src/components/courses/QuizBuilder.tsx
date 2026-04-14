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

  // Passing score state
  const [currentPassingScore, setCurrentPassingScore] = useState(passingScore);
  const [editingPassingScore, setEditingPassingScore] = useState(false);
  const [passingScoreDraft, setPassingScoreDraft] = useState(passingScore);
  const [savingPassingScore, setSavingPassingScore] = useState(false);

  // Add question form state
  const [showForm, setShowForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<NewOption[]>(EMPTY_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline edit state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOptions, setEditOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([]);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Reorder state
  const [reordering, setReordering] = useState(false);

  const lessonApiBase = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`;
  const questionsApiBase = `${lessonApiBase}/quiz/questions`;

  // ── Passing score ─────────────────────────────────────────────────────────

  const handleSavePassingScore = async () => {
    const val = Math.max(1, Math.min(100, Math.round(passingScoreDraft)));
    setSavingPassingScore(true);
    try {
      const res = await fetch(lessonApiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify({ passingScore: val }) }),
      });
      if (res.ok) {
        setCurrentPassingScore(val);
        setEditingPassingScore(false);
        router.refresh();
      }
    } finally {
      setSavingPassingScore(false);
    }
  };

  // ── Add question form ─────────────────────────────────────────────────────

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
      const res = await fetch(questionsApiBase, {
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

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (questionId: string) => {
    setDeletingId(questionId);
    try {
      const res = await fetch(`${questionsApiBase}/${questionId}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ── Inline edit ───────────────────────────────────────────────────────────

  const startEdit = (question: QuizQuestion) => {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.text);
    setEditOptions(question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setEditError(null);
  };

  const handleEditOptionText = (idx: number, text: string) => {
    setEditOptions(editOptions.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleEditCorrect = (idx: number) => {
    setEditOptions(editOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };

  const handleSaveEdit = async (questionId: string) => {
    setEditError(null);
    if (!editQuestionText.trim()) {
      setEditError("Question text cannot be empty");
      return;
    }
    if (editOptions.some((o) => !o.text.trim())) {
      setEditError("All options must have text");
      return;
    }
    if (!editOptions.some((o) => o.isCorrect)) {
      setEditError("Mark one option as correct");
      return;
    }

    setSavingEditId(questionId);
    try {
      const res = await fetch(`${questionsApiBase}/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editQuestionText.trim(),
          options: editOptions.map((o) => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setEditError(data.error ?? "Failed to save changes");
        return;
      }

      const updated = (await res.json()) as QuizQuestion;
      setQuestions(questions.map((q) => (q.id === questionId ? updated : q)));
      setEditingQuestionId(null);
      router.refresh();
    } catch {
      setEditError("An unexpected error occurred");
    } finally {
      setSavingEditId(null);
    }
  };

  // ── Reorder ───────────────────────────────────────────────────────────────

  const moveQuestion = async (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;

    const reordered = [...questions];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    setReordering(true);
    try {
      const res = await fetch(`${questionsApiBase}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((q) => q.id) }),
      });

      if (res.ok) {
        const updated = (await res.json()) as QuizQuestion[];
        setQuestions(updated);
        router.refresh();
      }
    } finally {
      setReordering(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-[#2e2e3a]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Quiz Builder
          </h2>
          {editingPassingScore ? (
            <div className="flex items-center gap-2 mt-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Passing score:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={passingScoreDraft}
                onChange={(e) => setPassingScoreDraft(Number(e.target.value))}
                aria-label="Passing score"
                className="w-16 rounded border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-xs text-gray-500">%</span>
              <button
                onClick={handleSavePassingScore}
                disabled={savingPassingScore}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
              >
                {savingPassingScore ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingPassingScore(false);
                  setPassingScoreDraft(currentPassingScore);
                }}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPassingScoreDraft(currentPassingScore);
                setEditingPassingScore(true);
              }}
              aria-label="Edit passing score"
              className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              Passing score: {currentPassingScore}% ✎
            </button>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 transition-colors"
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
            {editingQuestionId === question.id ? (
              /* Inline edit form */
              <div className="space-y-3">
                <input
                  type="text"
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  aria-label="Edit question text"
                  className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="space-y-2">
                  {editOptions.map((opt, oidx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`edit-correct-${question.id}`}
                        checked={opt.isCorrect}
                        onChange={() => handleEditCorrect(oidx)}
                        title={`Mark option ${oidx + 1} as correct`}
                        className="text-brand-600 focus:ring-brand-500 shrink-0"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleEditOptionText(oidx, e.target.value)}
                        aria-label={`Option ${oidx + 1} text`}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  ))}
                </div>
                {editError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(question.id)}
                    disabled={savingEditId === question.id}
                    className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                  >
                    {savingEditId === question.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg border border-gray-300 dark:border-[#3a3a48] text-xs text-gray-700 dark:text-gray-300 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only view */
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {idx + 1}. {question.text}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Reorder buttons */}
                    <button
                      onClick={() => moveQuestion(idx, "up")}
                      disabled={idx === 0 || reordering}
                      aria-label={`Move question ${idx + 1} up`}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs px-1 transition-colors"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveQuestion(idx, "down")}
                      disabled={idx === questions.length - 1 || reordering}
                      aria-label={`Move question ${idx + 1} down`}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs px-1 transition-colors"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => startEdit(question)}
                      aria-label={`Edit question ${idx + 1}`}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline px-1 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      disabled={deletingId === question.id}
                      aria-label={`Delete question ${idx + 1}`}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 px-1 transition-colors"
                    >
                      {deletingId === question.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
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
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add question form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-brand-200 dark:border-brand-800/40 bg-brand-50/30 dark:bg-brand-950/10 p-5 space-y-4"
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
              className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="text-brand-600 focus:ring-brand-500 shrink-0"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
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
              className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
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
