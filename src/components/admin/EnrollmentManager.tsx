"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import type { NodeWithChildren } from "@/lib/courseNodes";

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Enrollment {
  id: string;
  course: Course;
  user: User;
  enrolledBy: User | null;
  enrolledAt: string;
}

interface EnrollmentManagerProps {
  nodeTree: NodeWithChildren[];
  users: User[];
  initialEnrollments: Enrollment[];
}

export function EnrollmentManager({
  nodeTree,
  users,
  initialEnrollments,
}: EnrollmentManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    if (selectedCourseIds.size === 0 || !selectedUser) {
      setError("Please select at least one course and a user");
      return;
    }
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/enrollments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          courseIds: Array.from(selectedCourseIds),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to enroll user");
        return;
      }
      const result = (await res.json()) as {
        created: Enrollment[];
        skipped: string[];
        xpAwarded?: number;
      };
      if (result.created.length > 0) {
        setEnrollments([...result.created, ...enrollments]);
        toast(`Enrolled in ${result.created.length} course${result.created.length !== 1 ? "s" : ""}`);
      }
      if (result.skipped.length > 0) {
        toast(`${result.skipped.length} already enrolled (skipped)`);
      }
      setSelectedCourseIds(new Set());
      setSelectedUser("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (id: string) => {
    setUnenrollingId(id);
    try {
      const res = await fetch(`/api/admin/enrollments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEnrollments(enrollments.filter((e) => e.id !== id));
        router.refresh();
      }
    } finally {
      setUnenrollingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enroll form */}
      <div className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-5 space-y-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Select courses from the tree and a user to enroll
        </p>

        {/* Course tree */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Courses ({selectedCourseIds.size} selected)
          </label>
          <CourseNodeTree
            nodes={nodeTree}
            selectedCourseIds={selectedCourseIds}
            onSelectionChange={setSelectedCourseIds}
          />
        </div>

        {/* User select + enroll button */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Select user to enroll"
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
            onClick={() => void handleEnroll()}
            disabled={enrolling || selectedCourseIds.size === 0 || !selectedUser}
            className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {enrolling ? "Enrolling…" : `Enroll in ${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Enrollment list */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2e2e3a]">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {enrollments.length} enrollment{enrollments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-8 text-center">
            No enrollments yet.
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
                  Enrolled by
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
              {enrollments.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {e.user.name ?? e.user.email}
                    </p>
                    <p className="text-xs text-gray-400">{e.user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                    {e.course.title}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {e.enrolledBy ? (e.enrolledBy.name ?? e.enrolledBy.email) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => void handleUnenroll(e.id)}
                      disabled={unenrollingId === e.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      aria-label={`Unenroll ${e.user.name ?? e.user.email}`}
                    >
                      {unenrollingId === e.id ? "Unenrolling…" : "Unenroll"}
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
