"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { Role } from "@/lib/types";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  createdAt: string;
}

export default function UserTable() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Failed to load users (${res.status})`
          );
        }
        return res.json() as Promise<User[]>;
      })
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setLoading(false);
      });
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdating(userId);
    setUpdateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      const updated: User = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u))
      );
      toast(`Role updated to ${newRole}`);
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
              {["User", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400 py-8 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updateError && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
          {updateError}
        </div>
      )}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                User
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                Role
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                Joined
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user.name} image={user.avatar} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as Role)
                      }
                      disabled={updating === user.id}
                      aria-label={`Role for ${user.name || user.email}`}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-base sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="instructor">Instructor</option>
                      <option value="employee">Employee</option>
                    </select>
                    {updating === user.id && <Spinner size="sm" />}
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
