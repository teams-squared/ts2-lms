"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import type { NodeWithChildren } from "@/lib/courseNodes";
import type { Role } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteUserFormProps {
  nodeTree: NodeWithChildren[];
  /** Role of the admin currently viewing — controls role-picker options. */
  inviterRole: Role;
  onCancel: () => void;
  /** Called after a successful invite; parent should refresh list + toast. */
  onSuccess: (user: { id: string; email: string; name: string | null; role: Role }) => void;
}

export function InviteUserForm({
  nodeTree,
  inviterRole,
  onCancel,
  onSuccess,
}: InviteUserFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPickElevatedRole = inviterRole === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || null,
          role,
          courseIds: Array.from(selectedCourseIds),
        }),
      });

      if (res.status === 409) {
        setError(
          "A user with this email already exists. Use the Assignments page to enroll them.",
        );
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to send invite");
        return;
      }

      const result = (await res.json()) as {
        user: { id: string; email: string; name: string | null; role: Role };
        enrollmentCount: number;
        emailSent: boolean;
      };

      const parts: string[] = [];
      parts.push(`Invited ${result.user.email}`);
      if (result.enrollmentCount > 0) {
        parts.push(
          `enrolled in ${result.enrollmentCount} course${result.enrollmentCount !== 1 ? "s" : ""}`,
        );
      }
      if (!result.emailSent) {
        parts.push("(email not sent — Resend not configured)");
      }
      toast(parts.join(" · "));

      onSuccess(result.user);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-5 space-y-4 mb-5"
      aria-label="Invite user form"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Invite a new user</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Pre-create an account and optionally pre-assign courses. The user gets an
            email with a sign-in link.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="invite-email"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            Email <span className="text-danger">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newhire@teamsquared.io"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="invite-name"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            Name
          </label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional — will be overwritten by SSO on first login"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            disabled={submitting}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="invite-role"
          className="block text-xs font-medium text-foreground-muted mb-1"
        >
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          disabled={submitting}
        >
          <option value="employee">Employee</option>
          {canPickElevatedRole && <option value="course_manager">Course manager</option>}
          {canPickElevatedRole && <option value="admin">Admin</option>}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">
          Pre-assign courses ({selectedCourseIds.size} selected)
        </label>
        {nodeTree.length === 0 ? (
          <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border">
            No published courses yet. You can invite without courses; assign later from the
            Assignments page.
          </p>
        ) : (
          <CourseNodeTree
            nodes={nodeTree}
            selectedCourseIds={selectedCourseIds}
            onSelectionChange={setSelectedCourseIds}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {submitting
            ? "Sending…"
            : selectedCourseIds.size > 0
              ? `Send invite · ${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`
              : "Send invite"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-border bg-surface hover:bg-surface-muted text-sm font-medium text-foreground px-4 py-2 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
