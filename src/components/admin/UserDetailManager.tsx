"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import type { Role } from "@/lib/types";

interface UserDetailManagerProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  initialRole: Role;
  initialClearances: string[];
  availableClearances: string[];
  /** Count of enrollments this user has — shown in the remove-user confirm dialog. */
  enrollmentCount: number;
  /** Count of courses this user has authored — will be reassigned on remove. */
  authoredCourseCount: number;
  /** ID of the admin currently viewing — used to disable self-delete. */
  sessionUserId: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  course_manager: "Course Manager",
  employee: "Employee",
};

export function UserDetailManager({
  userId,
  userEmail,
  userName,
  initialRole,
  initialClearances,
  availableClearances: initialAvailableClearances,
  enrollmentCount,
  authoredCourseCount,
  sessionUserId,
}: UserDetailManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Role
  const [role, setRole] = useState<Role>(initialRole);
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState(false);

  // Clearances
  const [clearances, setClearances] = useState<string[]>(initialClearances);
  const [availClearances, setAvailClearances] = useState<string[]>(initialAvailableClearances);
  const [selectedClearance, setSelectedClearance] = useState("");
  const [grantingClearance, setGrantingClearance] = useState(false);
  const [revokingClearance, setRevokingClearance] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [clearanceError, setClearanceError] = useState<string | null>(null);

  // Remove user
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeConfirmText, setRemoveConfirmText] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const isSelf = sessionUserId === userId;
  const canConfirmRemove = removeConfirmText.trim().toLowerCase() === userEmail.toLowerCase();

  const handleRemoveUser = async () => {
    if (!canConfirmRemove || removing) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 409) {
          setRemoveError(data.error ?? "This user can't be removed");
        } else {
          setRemoveError(data.error ?? "Failed to remove user");
        }
        return;
      }
      const displayName = userName?.trim() || userEmail;
      toast(`Removed ${displayName}`);
      setRemoveOpen(false);
      router.push("/admin/users");
      router.refresh();
    } catch {
      setRemoveError("An unexpected error occurred");
    } finally {
      setRemoving(false);
    }
  };

  const handleCloseRemoveDialog = (open: boolean) => {
    if (removing) return; // don't close mid-request
    setRemoveOpen(open);
    if (!open) {
      setRemoveConfirmText("");
      setRemoveError(null);
    }
  };

  const handleGrantClearance = async () => {
    if (!selectedClearance) return;
    setGrantingClearance(true);
    setClearanceError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/clearances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearance: selectedClearance }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setClearanceError(data.error ?? "Failed to grant clearance");
        return;
      }
      setClearances((prev) => [...prev, selectedClearance]);
      setAvailClearances((prev) => prev.filter((c) => c !== selectedClearance));
      setSelectedClearance("");
      router.refresh();
    } catch {
      setClearanceError("An unexpected error occurred");
    } finally {
      setGrantingClearance(false);
    }
  };

  const handleRevokeClearance = async () => {
    if (!pendingRevoke) return;
    const clearance = pendingRevoke;
    setRevokingClearance(clearance);
    setClearanceError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/clearances/${encodeURIComponent(clearance)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setClearanceError(data.error ?? "Failed to revoke clearance");
        return;
      }
      setClearances((prev) => prev.filter((c) => c !== clearance));
      setAvailClearances((prev) => [...prev, clearance].sort());
      router.refresh();
    } catch {
      setClearanceError("An unexpected error occurred");
    } finally {
      setRevokingClearance(null);
      setPendingRevoke(null);
    }
  };

  const handleSaveRole = async () => {
    setSavingRole(true);
    setRoleError(null);
    setRoleSuccess(false);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setRoleError(data.error ?? "Failed to update role");
        return;
      }
      setRoleSuccess(true);
      router.refresh();
    } catch {
      setRoleError("An unexpected error occurred");
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Role</h3>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setRoleSuccess(false);
            }}
            aria-label="User role"
            className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(["admin", "course_manager", "employee"] as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={handleSaveRole}
            disabled={savingRole || role === initialRole}
            className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {savingRole ? "Saving…" : "Save role"}
          </button>
          {roleSuccess && (
            <span className="text-sm text-success">Saved!</span>
          )}
        </div>
        {roleError && (
          <p className="mt-2 text-sm text-danger">{roleError}</p>
        )}
      </div>

      {/* Clearances */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Clearances
        </h3>

        <div className="flex items-center gap-2 mb-4">
          <select
            value={selectedClearance}
            onChange={(e) => setSelectedClearance(e.target.value)}
            aria-label="Select clearance to grant"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a clearance…</option>
            {availClearances.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={handleGrantClearance}
            disabled={!selectedClearance || grantingClearance}
            aria-label="Grant clearance"
            className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {grantingClearance ? "Granting…" : "Grant"}
          </button>
        </div>

        {clearanceError && (
          <p className="mb-3 text-sm text-danger">{clearanceError}</p>
        )}

        {clearances.length === 0 ? (
          <p className="text-sm text-foreground-subtle italic">
            No clearances granted.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clearances.map((clearance) => (
              <span
                key={clearance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-subtle text-primary border border-primary/20"
              >
                {clearance}
                <button
                  onClick={() => setPendingRevoke(clearance)}
                  disabled={revokingClearance === clearance}
                  aria-label={`Revoke ${clearance} clearance`}
                  className="ml-0.5 text-primary/70 hover:text-danger disabled:opacity-50 transition-colors"
                >
                  {revokingClearance === clearance ? "…" : "×"}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone — permanent user removal */}
      <div className="rounded-lg border border-danger/30 bg-card p-6">
        <h3 className="text-sm font-semibold text-danger mb-1">Danger zone</h3>
        <p className="text-xs text-foreground-muted mb-4">
          Permanently delete this user and all of their activity data. Courses they
          authored will be reassigned to you. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setRemoveOpen(true)}
          disabled={isSelf}
          title={isSelf ? "You cannot remove your own account" : undefined}
          className="rounded-lg border border-danger/40 bg-card text-sm font-medium text-danger hover:bg-danger-subtle disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 transition-colors"
        >
          Remove user
        </button>
      </div>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={handleCloseRemoveDialog}
        title="Remove this user?"
        description={
          <div className="space-y-3">
            <p>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {userName?.trim() || userEmail}
              </span>
              , along with:
            </p>
            <ul className="list-disc pl-5 text-sm text-foreground-muted space-y-0.5">
              <li>
                {enrollmentCount} enrollment{enrollmentCount !== 1 ? "s" : ""}
              </li>
              <li>All lesson progress and quiz attempts</li>
              <li>All notifications, achievements, and XP</li>
              <li>All clearances</li>
            </ul>
            {authoredCourseCount > 0 && (
              <p className="text-sm text-foreground-muted">
                <span className="font-medium text-foreground">
                  {authoredCourseCount}
                </span>{" "}
                authored course{authoredCourseCount !== 1 ? "s" : ""} will be
                reassigned to you.
              </p>
            )}
            <p className="text-xs text-foreground-subtle">
              This cannot be undone. If they sign in again via SSO, a fresh empty
              account will be created.
            </p>
            <div>
              <label
                htmlFor="remove-confirm-email"
                className="block text-xs font-medium text-foreground-muted mb-1"
              >
                Type <span className="font-mono text-foreground">{userEmail}</span>{" "}
                to confirm
              </label>
              <input
                id="remove-confirm-email"
                type="text"
                value={removeConfirmText}
                onChange={(e) => setRemoveConfirmText(e.target.value)}
                disabled={removing}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
            {removeError && <p className="text-sm text-danger">{removeError}</p>}
          </div>
        }
        confirmLabel="Remove user"
        onConfirm={handleRemoveUser}
        loading={removing}
        disabled={!canConfirmRemove}
      />

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke clearance?"
        description={
          pendingRevoke ? (
            <>
              Revoke the{" "}
              <span className="font-medium text-foreground">{pendingRevoke}</span>{" "}
              clearance from this user? They will lose access to courses that require it.
            </>
          ) : null
        }
        confirmLabel="Revoke"
        onConfirm={handleRevokeClearance}
        loading={revokingClearance !== null}
      />
    </div>
  );
}
