"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SharePointFilePicker } from "./SharePointFilePicker";
import { QuizBuilder } from "./QuizBuilder";
import { NodeTreeSelect } from "./NodeTreeSelect";
import type { CourseStatus, LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  content: string | null;
  order: number;
  deadlineDays: number | null;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

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

interface QuizLessonData {
  questions: QuizQuestion[];
  passingScore: number;
}

interface CourseEditorProps {
  courseId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialStatus: CourseStatus;
  initialNodeId: string | null;
  nodeTree: { id: string; name: string; children: any[] }[];
  initialModules: Module[];
  quizDataByLessonId?: Record<string, QuizLessonData>;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export function CourseEditor({
  courseId,
  initialTitle,
  initialDescription,
  initialStatus,
  initialNodeId,
  nodeTree,
  initialModules,
  quizDataByLessonId = {},
}: CourseEditorProps) {
  const router = useRouter();

  // Course detail state
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [status, setStatus] = useState<CourseStatus>(initialStatus);
  const [nodeId, setNodeId] = useState<string>(initialNodeId ?? "");
  const [courseError, setCourseError] = useState<string | null>(null);
  const [courseSaving, setCourseSaving] = useState(false);

  // Module/lesson state
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Add module form
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);

  // Add lesson form state (per module)
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<LessonType>("text");
  const [addingLesson, setAddingLesson] = useState(false);

  // Lesson edit state
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<LessonType>("text");
  const [editDeadlineDays, setEditDeadlineDays] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // SharePoint picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"edit" | null>(null);

  // Delete state
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  // Inline quiz builder state
  const [expandedQuizLessons, setExpandedQuizLessons] = useState<Set<string>>(new Set());

  const toggleQuizBuilder = (lessonId: string) => {
    setExpandedQuizLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  // ─── Course save ───────────────────────────────────────────────────────────

  const handleSaveCourse = async () => {
    if (!title.trim()) {
      setCourseError("Title is required");
      return;
    }
    setCourseSaving(true);
    setCourseError(null);
    try {
      await apiFetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status, nodeId: nodeId || null }),
      });
      router.refresh();
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setCourseSaving(false);
    }
  };

  // ─── Module actions ────────────────────────────────────────────────────────

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      const created = await apiFetch<Module>(`/api/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newModuleTitle }),
      });
      setModules([...modules, { ...created, lessons: [] }]);
      setNewModuleTitle("");
      setShowAddModule(false);
      router.refresh();
    } catch {
      // silently ignore — user can retry
    } finally {
      setAddingModule(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    setDeletingModuleId(moduleId);
    try {
      await apiFetch(`/api/courses/${courseId}/modules/${moduleId}`, {
        method: "DELETE",
      });
      setModules(modules.filter((m) => m.id !== moduleId));
      router.refresh();
    } finally {
      setDeletingModuleId(null);
    }
  };

  // ─── Lesson actions ────────────────────────────────────────────────────────

  const handleAddLesson = async (moduleId: string) => {
    if (!newLessonTitle.trim()) return;
    setAddingLesson(true);
    try {
      const created = await apiFetch<Lesson>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newLessonTitle, type: newLessonType }),
        }
      );
      setModules(
        modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, created] } : m
        )
      );
      setNewLessonTitle("");
      setNewLessonType("text");
      setAddLessonModuleId(null);
      router.refresh();
    } catch {
      // silently ignore
    } finally {
      setAddingLesson(false);
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm("Delete this lesson?")) return;
    setDeletingLessonId(lessonId);
    try {
      await apiFetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        { method: "DELETE" }
      );
      setModules(
        modules.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m
        )
      );
      router.refresh();
    } finally {
      setDeletingLessonId(null);
    }
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title);
    setEditType(lesson.type);
    setEditContent(lesson.content ?? "");
    setEditDeadlineDays(lesson.deadlineDays);
    setEditError(null);
  };

  const handleSaveLesson = async () => {
    if (!editingLesson) return;
    if (!editTitle.trim()) {
      setEditError("Title is required");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const moduleId = modules.find((m) =>
        m.lessons.some((l) => l.id === editingLesson.id)
      )?.id;
      if (!moduleId) return;

      const updated = await apiFetch<Lesson>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${editingLesson.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle,
            type: editType,
            content: editContent || null,
            deadlineDays: editDeadlineDays,
          }),
        }
      );

      setModules(
        modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === editingLesson.id ? updated : l
                ),
              }
            : m
        )
      );
      setEditingLesson(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  const handlePickerSelect = (ref: SharePointDocumentRef) => {
    if (pickerTarget === "edit") {
      setEditContent(JSON.stringify(ref));
    }
    setPickerOpen(false);
    setPickerTarget(null);
  };

  return (
    <div className="space-y-8">
      {/* Course Details */}
      <section className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Course Details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Node
            </label>
            <NodeTreeSelect
              nodes={nodeTree}
              value={nodeId || null}
              onChange={(id) => setNodeId(id ?? "")}
            />
          </div>
          {courseError && (
            <p className="text-sm text-red-600 dark:text-red-400">{courseError}</p>
          )}
          <button
            onClick={handleSaveCourse}
            disabled={courseSaving}
            className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {courseSaving ? "Saving…" : "Save course"}
          </button>
        </div>
      </section>

      {/* Modules & Lessons */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Modules &amp; Lessons
          </h2>
          <button
            onClick={() => setShowAddModule(true)}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
          >
            + Add module
          </button>
        </div>

        {modules.length === 0 && !showAddModule && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No modules yet. Add one above.
          </p>
        )}

        <div className="space-y-3">
          {modules.map((module) => (
            <div
              key={module.id}
              className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden"
            >
              {/* Module header */}
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                onClick={() => toggleModule(module.id)}
              >
                <span className="text-gray-400 text-xs">
                  {expandedModules.has(module.id) ? "▼" : "▶"}
                </span>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                  {module.order}. {module.title}
                </p>
                <span className="text-xs text-gray-400">
                  {module.lessons.length} lesson{module.lessons.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteModule(module.id);
                  }}
                  disabled={deletingModuleId === module.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 ml-2"
                  aria-label={`Delete module ${module.title}`}
                >
                  Delete
                </button>
              </div>

              {/* Module lessons */}
              {expandedModules.has(module.id) && (
                <div className="border-t border-gray-100 dark:border-[#2a2a38] px-4 py-3 space-y-2">
                  {module.lessons.map((lesson) => (
                    <div key={lesson.id}>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50 dark:bg-[#18181f]">
                        <span className="text-xs text-gray-400 capitalize w-16 shrink-0">
                          {lesson.type}
                        </span>
                        <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">
                          {lesson.title}
                        </p>
                        {lesson.type === "quiz" ? (
                          <button
                            onClick={() => toggleQuizBuilder(lesson.id)}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                            data-testid={`toggle-quiz-builder-${lesson.id}`}
                          >
                            {expandedQuizLessons.has(lesson.id) ? "Quiz Builder ▲" : "Quiz Builder ▼"}
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditLesson(lesson)}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => void handleDeleteLesson(module.id, lesson.id)}
                          disabled={deletingLessonId === lesson.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          aria-label={`Delete lesson ${lesson.title}`}
                        >
                          Delete
                        </button>
                      </div>
                      {lesson.type === "quiz" && expandedQuizLessons.has(lesson.id) && (() => {
                        const qData = quizDataByLessonId[lesson.id];
                        if (!qData) return null;
                        return (
                          <div
                            className="mt-1 mb-1 rounded-xl border border-brand-200 dark:border-brand-800/40 bg-brand-50/30 dark:bg-brand-950/10 px-4 pb-4"
                            data-testid={`quiz-builder-panel-${lesson.id}`}
                          >
                            <QuizBuilder
                              initialQuestions={qData.questions}
                              passingScore={qData.passingScore}
                              courseId={courseId}
                              moduleId={module.id}
                              lessonId={lesson.id}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  ))}

                  {/* Add lesson */}
                  {addLessonModuleId === module.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(e.target.value)}
                        placeholder="Lesson title"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <select
                        value={newLessonType}
                        onChange={(e) => setNewLessonType(e.target.value as LessonType)}
                        className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        aria-label="Lesson type"
                      >
                        <option value="text">Text</option>
                        <option value="video">Video</option>
                        <option value="quiz">Quiz</option>
                        <option value="document">Document</option>
                      </select>
                      <button
                        onClick={() => void handleAddLesson(module.id)}
                        disabled={addingLesson}
                        className="rounded-lg bg-brand-600 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAddLessonModuleId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddLessonModuleId(module.id);
                        setNewLessonTitle("");
                        setNewLessonType("text");
                      }}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1"
                    >
                      + Add lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add module form */}
        {showAddModule && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module title"
              className="flex-1 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1c1c24] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => void handleAddModule()}
              disabled={addingModule}
              className="rounded-lg bg-brand-600 text-white text-sm px-4 py-2 disabled:opacity-50"
            >
              {addingModule ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => setShowAddModule(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Lesson edit modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white dark:bg-[#1a1a24] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3a3a48] p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Edit Lesson
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => {
                    setEditType(e.target.value as LessonType);
                    setEditContent("");
                  }}
                  className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label="Edit lesson type"
                >
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="quiz">Quiz</option>
                  <option value="document">Document</option>
                </select>
              </div>

              {editType === "document" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Document
                  </label>
                  {editContent ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                        {(() => {
                          try {
                            return (JSON.parse(editContent) as { fileName?: string }).fileName ?? "Selected file";
                          } catch {
                            return "Selected file";
                          }
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPickerTarget("edit");
                          setPickerOpen(true);
                        }}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerTarget("edit");
                        setPickerOpen(true);
                      }}
                      className="rounded-lg border border-dashed border-gray-300 dark:border-[#3a3a48] px-4 py-3 text-sm text-brand-600 dark:text-brand-400 w-full text-center hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors"
                    >
                      Browse SharePoint…
                    </button>
                  )}
                </div>
              ) : editType !== "quiz" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {editType === "video" ? "Video URL" : "Content (Markdown)"}
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={editType === "text" ? 6 : 2}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder={editType === "video" ? "https://www.youtube.com/embed/..." : "Markdown content…"}
                  />
                </div>
              ) : null}

              {/* Deadline */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Deadline (days after enrollment)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editDeadlineDays ?? ""}
                  onChange={(e) =>
                    setEditDeadlineDays(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  placeholder="No deadline"
                  className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Leave empty for no deadline
                </p>
              </div>

              {editError && (
                <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => void handleSaveLesson()}
                  disabled={editSaving}
                  className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingLesson(null)}
                  className="rounded-lg border border-gray-300 dark:border-[#3a3a48] text-sm text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SharePoint File Picker */}
      <SharePointFilePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
