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
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-foreground-muted">
          Select courses from the tree and a user to enroll
        </p>

        {/* Course tree */}
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
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
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {enrolling ? "Enrolling…" : `Enroll in ${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>

      {/* Enrollment list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            {enrollments.length} enrollment{enrollments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-foreground-subtle px-5 py-8 text-center">
            No enrollments yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted text-left">
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Course
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Enrolled by
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-surface-muted transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {e.user.name ?? e.user.email}
                    </p>
                    <p className="text-xs text-foreground-subtle">{e.user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    {e.course.title}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {e.enrolledBy ? (e.enrolledBy.name ?? e.enrolledBy.email) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => void handleUnenroll(e.id)}
                      disabled={unenrollingId === e.id}
                      className="text-xs text-danger hover:text-danger disabled:opacity-50"
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
