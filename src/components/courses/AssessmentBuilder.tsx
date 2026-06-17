"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/Sortable";
import { useToast } from "@/components/ui/ToastProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssessmentOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

type AssessmentQuestionType = "MULTIPLE_CHOICE" | "FREE_TEXT" | "MULTI_SELECT";

interface AssessmentQuestion {
  id: string;
  text: string;
  order: number;
  questionType: AssessmentQuestionType;
  maxMarks: number;
  options: AssessmentOption[];
}

/** Question types that carry selectable options (vs free-text). */
function hasOptions(type: AssessmentQuestionType): boolean {
  return type === "MULTIPLE_CHOICE" || type === "MULTI_SELECT";
}

const QUESTION_TYPE_LABEL: Record<AssessmentQuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  MULTI_SELECT: "Multiple answers (checkbox)",
  FREE_TEXT: "Written answer",
};

interface AssessmentVariant {
  id: string;
  label: string;
  order: number;
  questions: AssessmentQuestion[];
}

interface AssessmentConfig {
  timeLimitMinutes: number;
  passThreshold: number;
}

export interface AssessmentBuilderProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  initialConfig: AssessmentConfig | null;
  initialVariants: AssessmentVariant[];
}

interface NewOption {
  text: string;
  isCorrect: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_MC_OPTIONS: NewOption[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

// ── Per-variant question editor ───────────────────────────────────────────────

interface VariantQuestionEditorProps {
  variant: AssessmentVariant;
  variantQuestionsBase: string;
  onQuestionsChange: (variantId: string, questions: AssessmentQuestion[]) => void;
}

function VariantQuestionEditor({
  variant,
  variantQuestionsBase,
  onQuestionsChange,
}: VariantQuestionEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const questions = variant.questions;
  const setQuestions = (next: AssessmentQuestion[]) =>
    onQuestionsChange(variant.id, next);

  // ── Add question form ─────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<AssessmentQuestionType>("MULTIPLE_CHOICE");
  const [newText, setNewText] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState(1);
  const [newOptions, setNewOptions] = useState<NewOption[]>(EMPTY_MC_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddOption = () => {
    if (newOptions.length < 6) setNewOptions([...newOptions, { text: "", isCorrect: false }]);
  };
  const handleRemoveOption = (idx: number) => {
    if (newOptions.length > 2) setNewOptions(newOptions.filter((_, i) => i !== idx));
  };
  const handleOptionText = (idx: number, text: string) => {
    setNewOptions(newOptions.map((o, i) => (i === idx ? { ...o, text } : o)));
  };
  // MULTIPLE_CHOICE: exactly one correct (radio). MULTI_SELECT: toggle (checkbox).
  const handleCorrectChange = (idx: number) => {
    setNewOptions(newOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };
  const handleToggleCorrect = (idx: number) => {
    setNewOptions(newOptions.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o)));
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newText.trim()) { setAddError("Question text is required"); return; }
    if (newMaxMarks < 1) { setAddError("Max marks must be at least 1"); return; }
    if (hasOptions(newType)) {
      if (newOptions.length < 2 || newOptions.length > 6) { setAddError("Choice questions require 2–6 options"); return; }
      if (newOptions.some((o) => !o.text.trim())) { setAddError("All options must have text"); return; }
      if (!newOptions.some((o) => o.isCorrect)) {
        setAddError(newType === "MULTI_SELECT" ? "Mark at least one option as correct" : "Mark one option as correct");
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = hasOptions(newType)
        ? { text: newText.trim(), questionType: newType, maxMarks: newMaxMarks, options: newOptions }
        : { text: newText.trim(), questionType: newType, maxMarks: newMaxMarks };

      const res = await fetch(variantQuestionsBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAddError(data.error ?? "Failed to add question");
        return;
      }
      const created = (await res.json()) as AssessmentQuestion;
      setQuestions([...questions, created]);
      setNewText("");
      setNewMaxMarks(1);
      setNewOptions(EMPTY_MC_OPTIONS);
      setShowForm(false);
      router.refresh();
    } catch {
      setAddError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete question ────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssessmentQuestion | null>(null);

  const handleDeleteQuestion = async () => {
    if (!pendingDelete) return;
    const questionId = pendingDelete.id;
    setDeletingId(questionId);
    try {
      const res = await fetch(`${variantQuestionsBase}/${questionId}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId));
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to delete question", "error");
      }
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  // ── Inline edit ────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMaxMarks, setEditMaxMarks] = useState(1);
  const [editOptions, setEditOptions] = useState<{ id?: string; text: string; isCorrect: boolean }[]>([]);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editQuestionType, setEditQuestionType] = useState<AssessmentQuestionType>("MULTIPLE_CHOICE");

  const startEdit = (q: AssessmentQuestion) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditMaxMarks(q.maxMarks);
    setEditQuestionType(q.questionType);
    setEditOptions(q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
    setEditError(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const handleEditOptionText = (idx: number, text: string) => {
    setEditOptions(editOptions.map((o, i) => (i === idx ? { ...o, text } : o)));
  };
  const handleEditCorrect = (idx: number) => {
    setEditOptions(editOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };
  const handleEditToggleCorrect = (idx: number) => {
    setEditOptions(editOptions.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o)));
  };
  const handleEditAddOption = () => {
    if (editOptions.length < 6) setEditOptions([...editOptions, { text: "", isCorrect: false }]);
  };
  const handleEditRemoveOption = (idx: number) => {
    if (editOptions.length <= 2) return;
    const wasCorrect = editOptions[idx].isCorrect;
    const next = editOptions.filter((_, i) => i !== idx);
    if (wasCorrect && next.length > 0) next[0] = { ...next[0], isCorrect: true };
    setEditOptions(next);
  };

  const handleSaveEdit = async (questionId: string) => {
    setEditError(null);
    if (!editText.trim()) { setEditError("Question text cannot be empty"); return; }
    if (editMaxMarks < 1) { setEditError("Max marks must be at least 1"); return; }
    if (hasOptions(editQuestionType)) {
      if (editOptions.some((o) => !o.text.trim())) { setEditError("All options must have text"); return; }
      if (!editOptions.some((o) => o.isCorrect)) {
        setEditError(editQuestionType === "MULTI_SELECT" ? "Mark at least one option as correct" : "Mark one option as correct");
        return;
      }
    }

    setSavingEditId(questionId);
    try {
      const body = hasOptions(editQuestionType)
        ? { text: editText.trim(), maxMarks: editMaxMarks, options: editOptions.map((o) => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect })) }
        : { text: editText.trim(), maxMarks: editMaxMarks };

      const res = await fetch(`${variantQuestionsBase}/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setEditError(data.error ?? "Failed to save changes");
        return;
      }
      const updated = (await res.json()) as AssessmentQuestion;
      setQuestions(questions.map((q) => (q.id === questionId ? updated : q)));
      setEditingId(null);
      router.refresh();
    } catch {
      setEditError("An unexpected error occurred");
    } finally {
      setSavingEditId(null);
    }
  };

  // ── Reorder questions ──────────────────────────────────────────────────────
  const [reordering, setReordering] = useState(false);

  const handleReorder = async (next: AssessmentQuestion[]) => {
    const previous = questions;
    setQuestions(next);
    setReordering(true);
    try {
      const res = await fetch(`${variantQuestionsBase}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((q) => q.id) }),
      });
      if (res.ok) {
        const updated = (await res.json()) as AssessmentQuestion[];
        setQuestions(updated);
        router.refresh();
      } else {
        setQuestions(previous);
      }
    } catch {
      setQuestions(previous);
    } finally {
      setReordering(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-3">
      {questions.length === 0 && !showForm && (
        <p className="text-sm italic text-foreground-subtle mb-3">
          No questions yet. Add the first question below.
        </p>
      )}

      <SortableList
        items={questions}
        onReorder={handleReorder}
        disabled={reordering}
        className="mb-3 space-y-2"
      >
        {(question, idx) => (
          <SortableItem key={question.id} id={question.id} disabled={reordering}>
            {({ setNodeRef, style, dragHandleProps }) => (
              <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-surface p-4">
                {editingId === question.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit question text"
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
                      Max marks:
                      <input
                        type="number"
                        min={1}
                        value={editMaxMarks}
                        onChange={(e) => setEditMaxMarks(Number(e.target.value))}
                        className="w-14 rounded border border-border bg-surface px-2 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </label>
                    {hasOptions(editQuestionType) && (
                      <div className="space-y-2">
                        {editQuestionType === "MULTI_SELECT" && (
                          <p className="text-xs text-foreground-subtle">Tick every correct answer.</p>
                        )}
                        {editOptions.map((opt, oidx) => (
                          <div key={opt.id ?? `new-${oidx}`} className="flex flex-wrap items-center gap-2">
                            <input
                              type={editQuestionType === "MULTI_SELECT" ? "checkbox" : "radio"}
                              name={`edit-correct-${question.id}`}
                              checked={opt.isCorrect}
                              onChange={() =>
                                editQuestionType === "MULTI_SELECT"
                                  ? handleEditToggleCorrect(oidx)
                                  : handleEditCorrect(oidx)
                              }
                              title={`Mark option ${oidx + 1} as correct`}
                              className="shrink-0 text-primary focus:ring-ring"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => handleEditOptionText(oidx, e.target.value)}
                              placeholder={`Option ${oidx + 1}`}
                              aria-label={`Option ${oidx + 1} text`}
                              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            {editOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleEditRemoveOption(oidx)}
                                aria-label={`Remove option ${oidx + 1}`}
                                className="shrink-0 text-xs text-danger hover:text-danger/80"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        {editOptions.length < 6 && (
                          <button type="button" onClick={handleEditAddOption} className="text-xs text-primary hover:underline">
                            + Add option
                          </button>
                        )}
                      </div>
                    )}
                    {editError && <p className="text-xs text-danger">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleSaveEdit(question.id)}
                        disabled={savingEditId === question.id}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                      >
                        {savingEditId === question.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-1 items-start gap-2">
                        <DragHandle dragHandleProps={dragHandleProps} label={`Drag question ${idx + 1}`} size="sm" className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {idx + 1}. {question.text}
                          </p>
                          <p className="mt-0.5 text-xs text-foreground-subtle">
                            {QUESTION_TYPE_LABEL[question.questionType]}
                            {" · "}{question.maxMarks} mark{question.maxMarks !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => startEdit(question)}
                          aria-label={`Edit question ${idx + 1}`}
                          className="px-1 text-xs text-primary transition-colors hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setPendingDelete(question)}
                          disabled={deletingId === question.id}
                          aria-label={`Delete question ${idx + 1}`}
                          className="px-1 text-xs text-danger transition-colors hover:text-danger/80 disabled:opacity-50"
                        >
                          {deletingId === question.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                    {hasOptions(question.questionType) && (
                      <ul className="mt-2 space-y-1">
                        {question.options.map((opt) => (
                          <li key={opt.id} className="flex items-center gap-2 text-xs text-foreground-muted">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${opt.isCorrect ? "bg-success" : "bg-border"}`} />
                            {opt.text}
                            {opt.isCorrect && <span className="text-success">(correct)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {question.questionType === "MULTI_SELECT" && (
                      <p className="mt-2 text-xs italic text-foreground-subtle">Multiple answers — marked manually</p>
                    )}
                    {question.questionType === "FREE_TEXT" && (
                      <p className="mt-2 text-xs italic text-foreground-subtle">Written answer — marked manually</p>
                    )}
                  </>
                )}
              </div>
            )}
          </SortableItem>
        )}
      </SortableList>

      {/* Add question form */}
      {showForm ? (
        <form onSubmit={(e) => void handleSubmitQuestion(e)} className="space-y-4 rounded-lg border border-primary/20 bg-primary-subtle/30 p-5">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-foreground">Question text</label>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter your question…"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Type</label>
              <select
                value={newType}
                onChange={(e) => {
                  setNewType(e.target.value as AssessmentQuestionType);
                  setNewOptions(EMPTY_MC_OPTIONS);
                }}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
                <option value="MULTI_SELECT">Multiple answers (checkbox)</option>
                <option value="FREE_TEXT">Written answer</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
              Max marks:
              <input
                type="number"
                min={1}
                value={newMaxMarks}
                onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                className="w-14 rounded border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
          </div>
          {hasOptions(newType) && (
            <div>
              <label className="mb-2 block text-xs font-medium text-foreground">
                {newType === "MULTI_SELECT" ? "Options (tick every correct answer)" : "Options (mark one as correct)"}
              </label>
              <div className="space-y-2">
                {newOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={newType === "MULTI_SELECT" ? "checkbox" : "radio"}
                      name={`new-correct-option-${variant.id}`}
                      checked={opt.isCorrect}
                      onChange={() =>
                        newType === "MULTI_SELECT" ? handleToggleCorrect(idx) : handleCorrectChange(idx)
                      }
                      title={`Mark option ${idx + 1} as correct`}
                      className="shrink-0 text-primary focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionText(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {newOptions.length > 2 && (
                      <button type="button" onClick={() => handleRemoveOption(idx)} aria-label={`Remove option ${idx + 1}`} className="shrink-0 text-xs text-danger hover:text-danger/80">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {newOptions.length < 6 && (
                <button type="button" onClick={handleAddOption} className="mt-2 text-xs text-primary hover:underline">
                  + Add option
                </button>
              )}
            </div>
          )}
          {addError && <p className="text-sm text-danger">{addError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add question"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setAddError(null); setNewText(""); setNewOptions(EMPTY_MC_OPTIONS); setNewMaxMarks(1); }}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-primary hover:text-primary"
        >
          + Add question
        </button>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete question?"
        description={
          pendingDelete ? (
            <>
              Delete this question and all of its options? Any learner submissions referencing it
              will lose this question from their records.
              <span className="mt-2 block font-medium text-foreground">
                &ldquo;{pendingDelete.text}&rdquo;
              </span>
            </>
          ) : null
        }
        confirmLabel="Delete question"
        onConfirm={() => void handleDeleteQuestion()}
        loading={deletingId !== null}
      />
    </div>
  );
}

// ── Main AssessmentBuilder ────────────────────────────────────────────────────

export function AssessmentBuilder({
  courseId,
  moduleId,
  lessonId,
  initialConfig,
  initialVariants,
}: AssessmentBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const apiBase = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/assessment`;
  const variantsBase = `${apiBase}/variants`;

  // ── Variants state ─────────────────────────────────────────────────────────
  const [variants, setVariants] = useState<AssessmentVariant[]>(
    [...initialVariants].sort((a, b) => a.order - b.order),
  );

  // Collapsed state per variant (all open by default)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Config ─────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<AssessmentConfig | null>(initialConfig);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<AssessmentConfig>(
    initialConfig ?? { timeLimitMinutes: 60, passThreshold: 50 },
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const handleSaveConfig = async () => {
    setConfigError(null);
    if (configDraft.timeLimitMinutes < 1) {
      setConfigError("Time limit must be at least 1 minute");
      return;
    }
    if (configDraft.passThreshold < 0) {
      setConfigError("Pass threshold cannot be negative");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await fetch(`${apiBase}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeLimitMinutes: Math.round(configDraft.timeLimitMinutes),
          passThreshold: Math.round(configDraft.passThreshold),
        }),
      });
      if (res.ok) {
        setConfig({ ...configDraft });
        setEditingConfig(false);
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setConfigError(data.error ?? "Failed to save config");
      }
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Add variant ────────────────────────────────────────────────────────────
  const [addingVariant, setAddingVariant] = useState(false);

  const handleAddVariant = async () => {
    const label = `Variant ${variants.length + 1}`;
    setAddingVariant(true);
    try {
      const res = await fetch(variantsBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to add variant", "error");
        return;
      }
      const created = (await res.json()) as { id: string; label: string; order: number };
      setVariants([...variants, { ...created, questions: [] }]);
      router.refresh();
    } finally {
      setAddingVariant(false);
    }
  };

  // ── Rename variant ─────────────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);

  const startRename = (v: AssessmentVariant) => {
    setRenamingId(v.id);
    setRenameDraft(v.label);
  };
  const cancelRename = () => { setRenamingId(null); };

  const handleSaveRename = async (variantId: string) => {
    if (!renameDraft.trim()) return;
    setSavingRenameId(variantId);
    try {
      const res = await fetch(`${variantsBase}/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: renameDraft.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to rename variant", "error");
        return;
      }
      const updated = (await res.json()) as { id: string; label: string; order: number };
      setVariants(variants.map((v) => (v.id === variantId ? { ...v, label: updated.label } : v)));
      setRenamingId(null);
      router.refresh();
    } finally {
      setSavingRenameId(null);
    }
  };

  // ── Delete variant ─────────────────────────────────────────────────────────
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [pendingDeleteVariant, setPendingDeleteVariant] = useState<AssessmentVariant | null>(null);

  const handleDeleteVariant = async () => {
    if (!pendingDeleteVariant) return;
    const variantId = pendingDeleteVariant.id;
    setDeletingVariantId(variantId);
    try {
      const res = await fetch(`${variantsBase}/${variantId}`, { method: "DELETE" });
      if (res.ok) {
        setVariants(variants.filter((v) => v.id !== variantId));
        router.refresh();
      } else if (res.status === 409) {
        // Variant has existing student submissions — cannot delete
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Cannot delete a variant that students have already attempted.", "error");
      } else {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to delete variant", "error");
      }
    } finally {
      setDeletingVariantId(null);
      setPendingDeleteVariant(null);
    }
  };

  // ── Reorder variants ───────────────────────────────────────────────────────
  const [reorderingVariants, setReorderingVariants] = useState(false);

  const handleReorderVariants = async (next: AssessmentVariant[]) => {
    const previous = variants;
    setVariants(next);
    setReorderingVariants(true);
    try {
      const res = await fetch(`${variantsBase}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((v) => v.id) }),
      });
      if (!res.ok) {
        setVariants(previous);
        toast("Failed to reorder variants", "error");
      } else {
        router.refresh();
      }
    } catch {
      setVariants(previous);
    } finally {
      setReorderingVariants(false);
    }
  };

  // ── Update questions for a variant ────────────────────────────────────────
  const handleQuestionsChange = (variantId: string, questions: AssessmentQuestion[]) => {
    setVariants(variants.map((v) => (v.id === variantId ? { ...v, questions } : v)));
  };

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalMarksAllVariants = variants.reduce(
    (acc, v) => acc + v.questions.reduce((s, q) => s + q.maxMarks, 0),
    0,
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-8 border-t border-border pt-8">
      {/* Header + config */}
      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Assessment Builder
        </h2>

        {editingConfig ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
                Time limit (min):
                <input
                  type="number"
                  min={1}
                  value={configDraft.timeLimitMinutes}
                  onChange={(e) => setConfigDraft((c) => ({ ...c, timeLimitMinutes: Number(e.target.value) }))}
                  className="w-16 rounded border border-border bg-surface px-2 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
                Pass threshold (marks):
                <input
                  type="number"
                  min={0}
                  value={configDraft.passThreshold}
                  onChange={(e) => setConfigDraft((c) => ({ ...c, passThreshold: Number(e.target.value) }))}
                  className="w-16 rounded border border-border bg-surface px-2 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              {totalMarksAllVariants > 0 && (
                <span className="text-xs text-foreground-subtle">
                  (total available across variants: {totalMarksAllVariants} marks)
                </span>
              )}
            </div>
            {configError && <p className="text-xs text-danger">{configError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveConfig()}
                disabled={savingConfig}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {savingConfig ? "Saving…" : "Save config"}
              </button>
              <button
                onClick={() => { setEditingConfig(false); setConfigDraft(config ?? { timeLimitMinutes: 60, passThreshold: 50 }); }}
                className="text-xs text-foreground-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setConfigDraft(config ?? { timeLimitMinutes: 60, passThreshold: 50 });
              setEditingConfig(true);
            }}
            aria-label="Edit assessment config"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-foreground-muted transition-colors hover:text-primary"
          >
            {config ? (
              <span>
                {config.timeLimitMinutes} min · pass threshold: {config.passThreshold} marks
              </span>
            ) : (
              <span className="text-warning">Not configured — click to set up</span>
            )}
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        )}

        {/* Variants info blurb */}
        <p className="mt-3 text-xs text-foreground-subtle max-w-prose">
          Each student is randomly assigned one variant per attempt and won&rsquo;t see a repeat
          until all variants are exhausted. Keep variants comparable in difficulty and total marks.
          Time limit and pass threshold apply equally to every variant.
        </p>
      </div>

      {/* Empty state */}
      {variants.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-8 text-center">
          <p className="text-sm font-medium text-foreground">No variants yet</p>
          <p className="mt-1 text-xs text-foreground-subtle">
            Add the first variant to start building your question sets.
          </p>
          <button
            onClick={() => void handleAddVariant()}
            disabled={addingVariant}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {addingVariant ? "Creating…" : "Add first variant"}
          </button>
        </div>
      )}

      {/* Variants list */}
      {variants.length > 0 && (
        <>
          <SortableList
            items={variants}
            onReorder={handleReorderVariants}
            disabled={reorderingVariants}
            className="space-y-4"
          >
            {(variant) => (
              <SortableItem key={variant.id} id={variant.id} disabled={reorderingVariants}>
                {({ setNodeRef, style, dragHandleProps }) => {
                  const variantTotalMarks = variant.questions.reduce((s, q) => s + q.maxMarks, 0);
                  const isCollapsed = collapsed[variant.id] ?? false;

                  return (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className="rounded-lg border border-border bg-surface"
                    >
                      {/* Variant header */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <DragHandle
                          dragHandleProps={dragHandleProps}
                          label={`Drag variant ${variant.label}`}
                          size="sm"
                        />

                        {renamingId === variant.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveRename(variant.id);
                                if (e.key === "Escape") cancelRename();
                              }}
                              aria-label="Variant label"
                              autoFocus
                              className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <button
                              onClick={() => void handleSaveRename(variant.id)}
                              disabled={savingRenameId === variant.id || !renameDraft.trim()}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {savingRenameId === variant.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={cancelRename}
                              className="text-xs text-foreground-muted hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleCollapsed(variant.id)}
                            className="flex flex-1 items-center gap-2 text-left"
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 shrink-0 text-foreground-subtle" />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0 text-foreground-subtle" />
                            )}
                            <span className="text-sm font-medium text-foreground">{variant.label}</span>
                            <span className="text-xs text-foreground-subtle">
                              {variant.questions.length} question{variant.questions.length !== 1 ? "s" : ""}
                              {variantTotalMarks > 0 && ` · ${variantTotalMarks} marks`}
                            </span>
                          </button>
                        )}

                        {renamingId !== variant.id && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => startRename(variant)}
                              aria-label={`Rename variant ${variant.label}`}
                              className="px-1 text-xs text-primary transition-colors hover:underline"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => setPendingDeleteVariant(variant)}
                              disabled={deletingVariantId === variant.id}
                              aria-label={`Delete variant ${variant.label}`}
                              className="px-1 text-xs text-danger transition-colors hover:text-danger/80 disabled:opacity-50"
                            >
                              {deletingVariantId === variant.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Variant questions (collapsible) */}
                      {!isCollapsed && (
                        <div className="border-t border-border px-4 pb-4">
                          <VariantQuestionEditor
                            variant={variant}
                            variantQuestionsBase={`${variantsBase}/${variant.id}/questions`}
                            onQuestionsChange={handleQuestionsChange}
                          />
                        </div>
                      )}
                    </div>
                  );
                }}
              </SortableItem>
            )}
          </SortableList>

          <div className="mt-4">
            <button
              onClick={() => void handleAddVariant()}
              disabled={addingVariant}
              className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {addingVariant ? "Creating…" : "+ Add variant"}
            </button>
          </div>
        </>
      )}

      {/* Confirm delete variant */}
      <ConfirmDialog
        open={pendingDeleteVariant !== null}
        onOpenChange={(open) => !open && setPendingDeleteVariant(null)}
        title="Delete variant?"
        description={
          pendingDeleteVariant ? (
            <>
              Delete variant &ldquo;{pendingDeleteVariant.label}&rdquo; and all {pendingDeleteVariant.questions.length} of its question{pendingDeleteVariant.questions.length !== 1 ? "s" : ""}?
              This cannot be undone. If students have already attempted this variant, the delete will be blocked.
            </>
          ) : null
        }
        confirmLabel="Delete variant"
        onConfirm={() => void handleDeleteVariant()}
        loading={deletingVariantId !== null}
      />
    </div>
  );
}
