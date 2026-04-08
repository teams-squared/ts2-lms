"use client";

import { useState, useEffect } from "react";
import type { Role } from "@/lib/types";
import { Input, Select, Button } from "@/components/ui";
import { useMessage } from "@/hooks/useMessage";

interface RoleUser {
  email: string;
  role: Role;
}

export default function RoleManager() {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("manager");
  const [saving, setSaving] = useState(false);
  const { message, showMessage } = useMessage(3000);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showMessage("error", "Could not load role assignments");
      }
    } catch {
      showMessage("error", "Could not load role assignments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          role: newRole,
        }),
      });

      if (res.ok) {
        showMessage("success", `Assigned ${newRole} role to ${newEmail}`);
        setNewEmail("");
        await fetchUsers();
      } else {
        showMessage("error", "Failed to assign role");
      }
    } catch {
      showMessage("error", "Failed to assign role");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(email: string) {
    if (
      !window.confirm(
        `Remove elevated role from ${email}?\nThis takes effect on their next sign-in.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        showMessage("success", `Removed elevated role from ${email}`);
        await fetchUsers();
      } else {
        showMessage("error", "Failed to remove role");
      }
    } catch {
      showMessage("error", "Failed to remove role");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role Management</h2>
        {message && (
          <div
            className={`text-xs px-3 py-1 rounded-full ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-[#26262e]">
          <thead className="bg-gray-50 dark:bg-[#18181e]">
            <tr>
              {["Email", "Role", "Actions"].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider ${i === 2 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-[#22222e]">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-600">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-600">
                  No elevated role assignments
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.email} className="hover:bg-gray-50/50 dark:hover:bg-[#1e1e28] transition-colors">
                  <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-200">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                          : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRemove(user.email)}
                      className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}

            {/* Add user row */}
            <tr className="bg-gray-50/50 dark:bg-[#18181e]">
              <td className="px-4 py-2" colSpan={3}>
                <form onSubmit={handleAdd} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@teamssquared.com"
                    required
                    className="flex-1 py-1.5"
                  />
                  <Select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="py-1.5"
                  >
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <Button type="submit" disabled={saving} className="py-1.5">
                    {saving ? "…" : "Add"}
                  </Button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-600">
        Users not listed here default to the <strong className="text-gray-500 dark:text-gray-500">employee</strong> role.
        Role changes take effect on the user&apos;s next sign-in.
      </p>
    </div>
  );
}
