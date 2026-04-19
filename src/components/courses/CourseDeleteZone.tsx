"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

interface CourseDeleteZoneProps {
  courseId: string;
  courseTitle: string;
}

export function CourseDeleteZone({ courseId, courseTitle }: CourseDeleteZoneProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim() === courseTitle.trim();

  const handleDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to delete course");
        return;
      }
      toast(`Deleted "${courseTitle}"`);
      setOpen(false);
      router.push("/admin/courses");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (deleting) return;
    setOpen(next);
    if (!next) {
      setConfirmText("");
      setError(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-danger/30 bg-card p-6">
        <h3 className="text-sm font-semibold text-danger mb-1">Danger zone</h3>
        <p className="text-xs text-foreground-muted mb-4">
          Permanently delete this course and all of its content — modules, lessons, quiz
          data, enrollments, and progress records. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-danger/40 bg-card text-sm font-medium text-danger hover:bg-danger-subtle px-4 py-2 transition-colors"
        >
          Delete course
        </button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Delete this course?"
        description={
          <div className="space-y-3">
            <p>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{courseTitle}</span> and all
              of its associated data:
            </p>
            <ul className="list-disc pl-5 text-sm text-foreground-muted space-y-0.5">
              <li>All modules and lessons</li>
              <li>All quiz questions, options, and attempts</li>
              <li>All enrollments and lesson progress</li>
              <li>All email subscriptions</li>
            </ul>
            <p className="text-xs text-foreground-subtle">
              This cannot be undone.
            </p>
            <div>
              <label
                htmlFor="delete-course-confirm"
                className="block text-xs font-medium text-foreground-muted mb-1"
              >
                Type{" "}
                <span className="font-mono text-foreground">{courseTitle}</span>{" "}
                to confirm
              </label>
              <input
                id="delete-course-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        }
        confirmLabel="Delete course"
        onConfirm={handleDelete}
        loading={deleting}
        disabled={!canConfirm}
      />
    </>
  );
}
