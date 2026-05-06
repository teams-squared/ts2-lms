"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/button";

interface ManagerUser {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "COURSE_MANAGER";
}

interface CourseManagersPanelProps {
  courseId: string;
  initialManagers: ManagerUser[];
  assignableUsers: ManagerUser[];
}

/**
 * Admin-only panel on the course edit page for managing the CourseManagers
 * m2m. Lets an admin add or remove course_manager / admin users from the
 * course's manager list.
 */
export function CourseManagersPanel({
  courseId,
  initialManagers,
  assignableUsers,
}: CourseManagersPanelProps) {
  const { toast } = useToast();
  const [managers, setManagers] = useState<ManagerUser[]>(initialManagers);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const linked = new Set(managers.map((m) => m.id));
    return assignableUsers.filter((u) => !linked.has(u.id));
  }, [assignableUsers, managers]);

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to add manager");
        return;
      }
      const added = (await res.json()) as ManagerUser;
      setManagers((prev) => [...prev, added].sort(byName));
      setSelectedUserId("");
      toast(`Added ${added.name ?? added.email} as a manager`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (m: ManagerUser) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/managers/${m.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to remove manager");
        return;
      }
      setManagers((prev) => prev.filter((x) => x.id !== m.id));
      toast(`Removed ${m.name ?? m.email}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Course managers
      </h3>
      <p className="text-xs text-foreground-muted mb-4">
        Course managers linked here can edit this course and manage its
        enrollments. Admins can always edit every course regardless of this
        list.
      </p>

      {/* Current managers */}
      {managers.length === 0 ? (
        <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border mb-4">
          No managers yet. Only admins can edit this course until one is
          assigned.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg mb-4">
          {managers.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {m.name ?? m.email}
                  {m.role === "ADMIN" && (
                    <span className="ml-2 text-xs text-foreground-subtle">
                      (admin)
                    </span>
                  )}
                </p>
                <p className="text-xs text-foreground-muted truncate">
                  {m.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m)}
                disabled={busy}
                className="text-xs text-danger hover:text-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                aria-label={`Remove ${m.name ?? m.email}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[14rem]">
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Add manager
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={busy || candidates.length === 0}
            className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label="Select user to add as a manager"
          >
            <option value="">
              {candidates.length === 0
                ? "No more eligible users"
                : "Select user"}
            </option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name ?? u.email)}
                {u.role === "ADMIN" ? " (admin)" : ""} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => void handleAdd()}
          disabled={busy || !selectedUserId}
        >
          Add
        </Button>
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}

function byName(a: ManagerUser, b: ManagerUser) {
  const an = (a.name ?? a.email).toLowerCase();
  const bn = (b.name ?? b.email).toLowerCase();
  return an.localeCompare(bn);
}
