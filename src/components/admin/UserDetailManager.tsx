"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

interface UserDetailManagerProps {
  userId: string;
  initialRole: Role;
  initialClearances: string[];
  availableClearances: string[];
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  course_manager: "Course Manager",
  employee: "Employee",
};

export function UserDetailManager({
  userId,
  initialRole,
  initialClearances,
  availableClearances: initialAvailableClearances,
}: UserDetailManagerProps) {
  const router = useRouter();

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
  const [clearanceError, setClearanceError] = useState<string | null>(null);

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

  const handleRevokeClearance = async (clearance: string) => {
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
                  onClick={() => handleRevokeClearance(clearance)}
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
    </div>
  );
}
