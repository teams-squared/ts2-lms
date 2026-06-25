"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import { ADMIN_LIST_SCROLL, ADMIN_LIST_THEAD } from "@/components/admin/listScroll";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { NodeWithChildren } from "@/lib/courseNodes";

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Enrollment {
  id: string;
  course: Course;
  user: User;
  enrolledBy: User | null;
  enrolledAt: string;
  /** Empty = whole course; otherwise the assigned-module subset. */
  scopedModuleIds: string[];
}

interface ModuleOption {
  id: string;
  title: string;
  order: number;
  lessonCount: number;
}

interface EnrollmentManagerProps {
  nodeTree: NodeWithChildren[];
  users: User[];
  initialEnrollments: Enrollment[];
}

/** Fetch a course's modules for the scope picker. */
async function fetchModules(courseId: string): Promise<ModuleOption[]> {
  const res = await fetch(`/api/courses/${courseId}/modules`);
  if (!res.ok) throw new Error("Failed to load modules");
  const data = (await res.json()) as {
    id: string;
    title: string;
    order: number;
    lessons: unknown[];
  }[];
  return data.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    lessonCount: m.lessons.length,
  }));
}

/** Checkbox list of modules. All checked = whole course. */
function ModulePicker({
  modules,
  selected,
  onToggle,
  onAll,
  onNone,
}: {
  modules: ModuleOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  const allSelected = selected.size === modules.length && modules.length > 0;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-foreground-muted">
          {allSelected
            ? "Whole course"
            : `${selected.size} of ${modules.length} modules`}
        </span>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={onAll}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onNone}
            className="text-foreground-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Clear
          </button>
        </div>
      </div>
      <ul className="max-h-48 overflow-y-auto p-1.5">
        {modules.map((m) => (
          <li key={m.id}>
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-muted cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => onToggle(m.id)}
                className="rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground flex-1 truncate">
                {m.title}
              </span>
              <span className="text-xs text-foreground-subtle">
                {m.lessonCount} lesson{m.lessonCount !== 1 ? "s" : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EnrollmentManager({
  nodeTree,
  users,
  initialEnrollments,
}: EnrollmentManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [pendingUnenroll, setPendingUnenroll] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Module scope picker — only shown when exactly one course is selected.
  const singleCourseId =
    selectedCourseIds.size === 1 ? [...selectedCourseIds][0] : null;
  const [courseModules, setCourseModules] = useState<ModuleOption[]>([]);
  const [moduleSel, setModuleSel] = useState<Set<string>>(new Set());
  const [modulesLoading, setModulesLoading] = useState(false);

  // Edit-scope dialog state.
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [editModules, setEditModules] = useState<ModuleOption[]>([]);
  const [editSel, setEditSel] = useState<Set<string>>(new Set());
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Load modules whenever the single selected course changes. Default: all
  // selected (= whole course).
  useEffect(() => {
    if (!singleCourseId) {
      setCourseModules([]);
      setModuleSel(new Set());
      return;
    }
    let cancelled = false;
    setModulesLoading(true);
    fetchModules(singleCourseId)
      .then((mods) => {
        if (cancelled) return;
        setCourseModules(mods);
        setModuleSel(new Set(mods.map((m) => m.id)));
      })
      .catch(() => {
        if (!cancelled) setCourseModules([]);
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [singleCourseId]);

  const toggleModule = useCallback((id: string) => {
    setModuleSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleEnroll = async () => {
    if (selectedCourseIds.size === 0 || !selectedUser) {
      setError("Please select at least one course and a user");
      return;
    }
    // Single course → may carry a module scope. All modules selected means
    // whole course (send no moduleIds). A subset sends the explicit allowlist.
    const isScoped =
      singleCourseId !== null &&
      courseModules.length > 0 &&
      moduleSel.size > 0 &&
      moduleSel.size < courseModules.length;

    if (singleCourseId && moduleSel.size === 0 && courseModules.length > 0) {
      setError("Select at least one module, or pick the whole course");
      return;
    }

    setEnrolling(true);
    setError(null);
    try {
      if (isScoped && singleCourseId) {
        // Single course with a module subset → single endpoint carrying scope.
        const res = await fetch("/api/admin/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser,
            courseId: singleCourseId,
            moduleIds: [...moduleSel],
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to enroll user");
          return;
        }
        toast("Enrolled with module scope");
      } else {
        // Multiple courses → whole-course batch enroll.
        const res = await fetch("/api/admin/enrollments/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser,
            courseIds: Array.from(selectedCourseIds),
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to enroll user");
          return;
        }
        const result = (await res.json()) as {
          created: Enrollment[];
          skipped: string[];
        };
        if (result.created.length > 0) {
          toast(
            `Enrolled in ${result.created.length} course${result.created.length !== 1 ? "s" : ""}`,
          );
        }
        if (result.skipped.length > 0) {
          toast(`${result.skipped.length} already enrolled (skipped)`);
        }
      }
      setSelectedCourseIds(new Set());
      setSelectedUser("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async () => {
    if (!pendingUnenroll) return;
    const id = pendingUnenroll.id;
    setUnenrollingId(id);
    try {
      const res = await fetch(`/api/admin/enrollments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEnrollments(enrollments.filter((e) => e.id !== id));
        toast("Enrollment removed");
        router.refresh();
      }
    } finally {
      setUnenrollingId(null);
      setPendingUnenroll(null);
    }
  };

  // ── Edit scope ────────────────────────────────────────────────────────────
  const openEdit = (enr: Enrollment) => {
    setEditing(enr);
    setEditLoading(true);
    setEditModules([]);
    setEditSel(new Set());
    fetchModules(enr.course.id)
      .then((mods) => {
        setEditModules(mods);
        // Empty scope = whole course → all checked.
        setEditSel(
          (enr.scopedModuleIds?.length ?? 0) === 0
            ? new Set(mods.map((m) => m.id))
            : new Set(enr.scopedModuleIds),
        );
      })
      .catch(() => toast("Failed to load modules"))
      .finally(() => setEditLoading(false));
  };

  const toggleEditModule = (id: string) => {
    setEditSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editSel.size === 0) {
      toast("Select at least one module, or the whole course");
      return;
    }
    // All selected = whole course → send [] (clears scope, auto-gets new modules).
    const wholeCourse = editSel.size === editModules.length;
    const moduleIds = wholeCourse ? [] : [...editSel];
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/admin/users/${editing.user.id}/enrollments/${editing.course.id}/modules`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleIds }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to update modules");
        return;
      }
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === editing.id ? { ...e, scopedModuleIds: moduleIds } : e,
        ),
      );
      toast(wholeCourse ? "Set to whole course" : "Module scope updated");
      setEditing(null);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enroll form */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Enroll a user</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Pick one or more courses from the tree, choose a user, then click Enroll.
            Select a single course to assign specific modules.
          </p>
        </div>

        {/* Course tree */}
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Courses <span className="text-foreground-subtle font-normal">({selectedCourseIds.size} selected)</span>
          </label>
          {nodeTree.length === 0 ? (
            <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border">
              No published courses available. Publish a course first, then return here to enroll users.
            </p>
          ) : (
            <CourseNodeTree
              nodes={nodeTree}
              selectedCourseIds={selectedCourseIds}
              onSelectionChange={setSelectedCourseIds}
            />
          )}
        </div>

        {/* Module scope — only when exactly one course is selected */}
        {singleCourseId && (
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Modules to assign
            </label>
            {modulesLoading ? (
              <p className="text-xs text-foreground-subtle px-3 py-2">
                Loading modules…
              </p>
            ) : courseModules.length === 0 ? (
              <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border">
                This course has no modules yet.
              </p>
            ) : (
              <ModulePicker
                modules={courseModules}
                selected={moduleSel}
                onToggle={toggleModule}
                onAll={() => setModuleSel(new Set(courseModules.map((m) => m.id)))}
                onNone={() => setModuleSel(new Set())}
              />
            )}
          </div>
        )}
        {selectedCourseIds.size > 1 && (
          <p className="text-xs text-foreground-subtle">
            Multiple courses selected — each is assigned in full. Select a single
            course to pick specific modules.
          </p>
        )}

        {/* User select + enroll button */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Select user to enroll"
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void handleEnroll()}
            disabled={enrolling || selectedCourseIds.size === 0 || !selectedUser}
            className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {enrolling ? "Enrolling…" : `Enroll in ${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>

      {/* Enrollment list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            {enrollments.length} enrollment{enrollments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-foreground-subtle px-5 py-8 text-center">
            No enrollments yet.
          </p>
        ) : (
          // Scroll the list internally so the page itself stays put.
          <div className={ADMIN_LIST_SCROLL}>
          <table className="w-full text-sm">
            <thead className={ADMIN_LIST_THEAD}>
              <tr className="bg-surface-muted text-left">
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Course
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Enrolled by
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-surface-muted transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {e.user.name ?? e.user.email}
                    </p>
                    <p className="text-xs text-foreground-subtle">{e.user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    {e.course.title}
                    {(e.scopedModuleIds?.length ?? 0) > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted">
                        {e.scopedModuleIds.length} module
                        {e.scopedModuleIds.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {e.enrolledBy ? (e.enrolledBy.name ?? e.enrolledBy.email) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(e)}
                      className="text-xs text-foreground-muted hover:text-foreground mr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                      aria-label={`Edit modules for ${e.user.name ?? e.user.email}`}
                    >
                      Edit modules
                    </button>
                    <button
                      onClick={() => setPendingUnenroll(e)}
                      disabled={unenrollingId === e.id}
                      className="text-xs text-danger hover:text-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                      aria-label={`Unenroll ${e.user.name ?? e.user.email}`}
                    >
                      {unenrollingId === e.id ? "Unenrolling…" : "Unenroll"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingUnenroll !== null}
        onOpenChange={(open) => !open && setPendingUnenroll(null)}
        title="Unenroll user?"
        description={
          pendingUnenroll ? (
            <>
              Remove{" "}
              <span className="font-medium text-foreground">
                {pendingUnenroll.user.name ?? pendingUnenroll.user.email}
              </span>{" "}
              from{" "}
              <span className="font-medium text-foreground">
                {pendingUnenroll.course.title}
              </span>
              ? Their progress on this course will be deleted.
            </>
          ) : null
        }
        confirmLabel="Unenroll"
        onConfirm={handleUnenroll}
        loading={unenrollingId !== null}
      />

      {/* Edit module scope */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigned modules</DialogTitle>
            <DialogDescription>
              {editing ? (
                <>
                  Choose which modules of{" "}
                  <span className="font-medium text-foreground">
                    {editing.course.title}
                  </span>{" "}
                  are assigned to{" "}
                  <span className="font-medium text-foreground">
                    {editing.user.name ?? editing.user.email}
                  </span>
                  . Selecting all modules makes it a whole-course enrollment.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {editLoading ? (
            <p className="text-sm text-foreground-subtle py-4">Loading modules…</p>
          ) : editModules.length === 0 ? (
            <p className="text-sm text-foreground-subtle py-4">
              This course has no modules.
            </p>
          ) : (
            <ModulePicker
              modules={editModules}
              selected={editSel}
              onToggle={toggleEditModule}
              onAll={() => setEditSel(new Set(editModules.map((m) => m.id)))}
              onNone={() => setEditSel(new Set())}
            />
          )}

          <DialogFooter>
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="rounded-lg border border-border bg-surface hover:bg-surface-muted text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void saveEdit()}
              disabled={editSaving || editLoading || editModules.length === 0}
              className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {editSaving ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
