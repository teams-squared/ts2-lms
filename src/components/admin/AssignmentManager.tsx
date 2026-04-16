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

interface Enrollment {
  id: string;
  course: Course;
  user: User;
  enrolledAt: string;
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
  initialEnrollments: Enrollment[];
  initialAssignments: Assignment[];
}

export function AssignmentManager({
  courses,
  users,
  initialEnrollments,
  initialAssignments,
}: AssignmentManagerProps) {
  const router = useRouter();

  // ── Enrollment state ─────────────────────────────────────────────────────
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [enrollCourse, setEnrollCourse] = useState("");
  const [enrollUser, setEnrollUser] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // ── Assignment state ─────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Enrollment handlers ──────────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!enrollCourse || !enrollUser) {
      setEnrollError("Please select both a course and a user");
      return;
    }
    setEnrolling(true);
    setEnrollError(null);
    setEnrollSuccess(null);
    try {
      const res = await fetch("/api/admin/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: enrollCourse, userId: enrollUser }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setEnrollError(data.error ?? "Failed to enroll user");
        return;
      }
      const newEnrollment = (await res.json()) as Enrollment;
      setEnrollments([
        {
          id: newEnrollment.id,
          course: newEnrollment.course,
          user: newEnrollment.user,
          enrolledAt: newEnrollment.enrolledAt ?? new Date().toISOString(),
        },
        ...enrollments,
      ]);
      setEnrollCourse("");
      setEnrollUser("");
      setEnrollSuccess("User enrolled successfully");
      router.refresh();
    } catch {
      setEnrollError("An unexpected error occurred");
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

  // ── Assignment handlers ──────────────────────────────────────────────────
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
    <div className="space-y-10">
      {/* ── Enrollments ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Enrollments
        </h3>

        {/* Enroll form */}
        <div className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-5">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
            Enroll a user in a course
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Course
              </label>
              <select
                value={enrollCourse}
                onChange={(e) => setEnrollCourse(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Select course to enroll"
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
                value={enrollUser}
                onChange={(e) => setEnrollUser(e.target.value)}
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
              disabled={enrolling}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {enrolling ? "Enrolling…" : "Enroll"}
            </button>
          </div>
          {enrollError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{enrollError}</p>
          )}
          {enrollSuccess && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
              {enrollSuccess}
            </p>
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
                    Enrolled
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
      </section>

      {/* ── Assignments ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Course Assignments
        </h3>

        {/* Assign form */}
        <div className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-5">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
            Assign a course to a user
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Course
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
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
      </section>
    </div>
  );
}
