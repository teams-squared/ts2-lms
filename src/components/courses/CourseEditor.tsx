"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NodeTreeSelect } from "./NodeTreeSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { NodeTreeItem } from "./NodeTreeSelect";
import type { CourseStatus } from "@/lib/types";

interface CourseEditorProps {
  courseId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialStatus: CourseStatus;
  initialNodeId: string | null;
  nodeTree: NodeTreeItem[];
  initialSubscriptions?: string[];
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
  initialSubscriptions = [],
}: CourseEditorProps) {
  const router = useRouter();

  // Course detail state
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [status, setStatus] = useState<CourseStatus>(initialStatus);
  const [nodeId, setNodeId] = useState<string>(initialNodeId ?? "");
  const [courseError, setCourseError] = useState<string | null>(null);
  const [courseSaving, setCourseSaving] = useState(false);

  // Email subscription state
  const [subscriptions, setSubscriptions] = useState<string[]>(initialSubscriptions);
  const [newEmail, setNewEmail] = useState("");
  const [subError, setSubError] = useState<string | null>(null);
  const [addingSub, setAddingSub] = useState(false);
  const [removingSub, setRemovingSub] = useState<string | null>(null);
  const [pendingRemoveSub, setPendingRemoveSub] = useState<string | null>(null);

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

  const handleAddSubscription = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubError("Enter a valid email address");
      return;
    }
    if (subscriptions.includes(email)) {
      setSubError("Already subscribed");
      return;
    }
    setAddingSub(true);
    setSubError(null);
    try {
      await apiFetch(`/api/courses/${courseId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubscriptions([...subscriptions, email]);
      setNewEmail("");
    } catch (err) {
      setSubError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAddingSub(false);
    }
  };

  const handleRemoveSubscription = async () => {
    if (!pendingRemoveSub) return;
    const email = pendingRemoveSub;
    setRemovingSub(email);
    try {
      await apiFetch(`/api/courses/${courseId}/subscriptions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubscriptions(subscriptions.filter((e) => e !== email));
    } catch {
      // silently ignore — user can retry
    } finally {
      setRemovingSub(null);
      setPendingRemoveSub(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Course Details */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Course Details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
              className="rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              Node
            </label>
            <NodeTreeSelect
              nodes={nodeTree}
              value={nodeId || null}
              onChange={(id) => setNodeId(id ?? "")}
            />
          </div>
          {courseError && (
            <p className="text-sm text-danger">{courseError}</p>
          )}
          <button
            onClick={handleSaveCourse}
            disabled={courseSaving}
            className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {courseSaving ? "Saving…" : "Save course"}
          </button>
        </div>
      </section>

      {/* Modules & Lessons — now managed on a dedicated page */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">
              Modules &amp; Lessons
            </h2>
            <p className="text-xs text-foreground-muted">
              Add, edit, delete, and reorder modules and lessons on the dedicated
              management page.
            </p>
          </div>
          <Link
            href={`/admin/courses/${courseId}/modules`}
            className="shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Manage modules &amp; lessons →
          </Link>
        </div>
      </section>

      {/* Completion Alerts */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Completion Alerts
        </h2>
        <p className="text-xs text-foreground-muted mb-4">
          Email addresses that will be notified when an employee completes this course.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setSubError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddSubscription(); }}
            placeholder="email@example.com"
            className="flex-1 rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => void handleAddSubscription()}
            disabled={addingSub}
            className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {addingSub ? "Adding…" : "Add"}
          </button>
        </div>

        {subError && (
          <p className="text-xs text-danger mb-3">{subError}</p>
        )}

        {subscriptions.length === 0 ? (
          <p className="text-xs text-foreground-subtle italic">
            No subscribers yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {subscriptions.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between rounded-lg px-3 py-2 bg-surface-muted"
              >
                <span className="text-sm text-foreground">{email}</span>
                <button
                  onClick={() => setPendingRemoveSub(email)}
                  disabled={removingSub === email}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {removingSub === email ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pendingRemoveSub !== null}
        onOpenChange={(open) => !open && setPendingRemoveSub(null)}
        title="Remove subscriber?"
        description={
          pendingRemoveSub ? (
            <>
              Remove{" "}
              <span className="font-medium text-foreground">
                {pendingRemoveSub}
              </span>{" "}
              from the deadline notification list for this course?
            </>
          ) : null
        }
        confirmLabel="Remove"
        onConfirm={handleRemoveSubscription}
        loading={removingSub !== null}
      />
    </div>
  );
}
