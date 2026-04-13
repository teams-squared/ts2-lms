"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Assignment {
  id: string;
  course: Course;
  user: User;
  assignedBy: User;
  assignedAt: string;
}

interface AssignmentManagerProps {
  courses: Course[];
  users: User[];
  initialAssignments: Assignment[];
}

export function AssignmentManager({
  courses,
  users,
  initialAssignments,
}: AssignmentManagerProps) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedCourse || !selectedUser) {
      setError("Please select both a course and a user");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourse, userId: selectedUser }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to assign");
        return;
      }
      const newAssignment = (await res.json()) as Assignment & {
        user: User;
        course: Course;
      };
      // Fetch fresh assignedBy from state
      const assignedBy = users.find((u) => u.id === newAssignment.user?.id) ?? {
        id: "",
        name: "You",
        email: "",
      };
      setAssignments([
        {
          id: newAssignment.id,
          course: newAssignment.course,
          user: newAssignment.user,
          assignedBy,
          assignedAt: new Date().toISOString(),
        },
        ...assignments,
      ]);
      setSelectedCourse("");
      setSelectedUser("");
      setSuccess("Course assigned successfully");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAssignments(assignments.filter((a) => a.id !== id));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assign form */}
      <div className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Assign Course to User
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Select course to assign"
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Select user to assign"
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
            onClick={() => void handleAssign()}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {submitting ? "Assigning…" : "Assign"}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
            {success}
          </p>
        )}
      </div>

      {/* Assignment list */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2e2e3a]">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-8 text-center">
            No assignments yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Course
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Assigned by
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
              {assignments.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {a.user.name ?? a.user.email}
                    </p>
                    <p className="text-xs text-gray-400">{a.user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                    {a.course.title}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {a.assignedBy.name ?? a.assignedBy.email}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => void handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      aria-label={`Remove assignment for ${a.user.name ?? a.user.email}`}
                    >
                      {deletingId === a.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
