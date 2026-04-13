"use client";

import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { Role } from "@/lib/types";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export default function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u))
      );
    } catch {
      // silent
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
        Loading users...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
            <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
              User
            </th>
            <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
              Role
            </th>
            <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
              Joined
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
                  <UserAvatar name={user.name} size="sm" />
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
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  disabled={updating === user.id}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </td>
              <td className="px-5 py-3 text-right text-xs text-gray-500 dark:text-gray-500">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
