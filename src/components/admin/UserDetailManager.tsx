"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

interface AssignedCourse {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  assignedAt: string;
}

interface AvailableCourse {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
}

interface UserDetailManagerProps {
  userId: string;
  initialRole: Role;
  initialAssignedCourses: AssignedCourse[];
  allCourses: AvailableCourse[];
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  instructor: "Instructor",
  employee: "Employee",
};

export function UserDetailManager({
  userId,
  initialRole,
  initialAssignedCourses,
  allCourses,
}: UserDetailManagerProps) {
  const router = useRouter();

  // Role
  const [role, setRole] = useState<Role>(initialRole);
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState(false);

  // Course assignments
  const [assignedCourses, setAssignedCourses] = useState<AssignedCourse[]>(initialAssignedCourses);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>(allCourses);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

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

  const handleAssignCourse = async () => {
    if (!selectedCourseId) return;
    setAssigning(true);
    setCourseError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setCourseError(data.error ?? "Failed to assign course");
        return;
      }
      const added = (await res.json()) as AssignedCourse;
      setAssignedCourses((prev) => [...prev, added]);
      setAvailableCourses((prev) => prev.filter((c) => c.id !== selectedCourseId));
      setSelectedCourseId("");
      router.refresh();
    } catch {
      setCourseError("An unexpected error occurred");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignCourse = async (courseId: string) => {
    setUnassigningId(courseId);
    setCourseError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/courses/${courseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setCourseError(data.error ?? "Failed to remove assignment");
        return;
      }
      const removed = assignedCourses.find((c) => c.id === courseId);
      setAssignedCourses((prev) => prev.filter((c) => c.id !== courseId));
      if (removed) {
        setAvailableCourses((prev) => [...prev, { id: removed.id, title: removed.title, status: removed.status }].sort((a, b) => a.title.localeCompare(b.title)));
      }
      router.refresh();
    } catch {
      setCourseError("An unexpected error occurred");
    } finally {
      setUnassigningId(null);
    }
  };

  const isInstructor = role === "instructor";

  return (
    <div className="space-y-6">
      {/* Role card */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Role</h3>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setRoleSuccess(false);
            }}
            aria-label="User role"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(["admin", "manager", "instructor", "employee"] as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={handleSaveRole}
            disabled={savingRole || role === initialRole}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            {savingRole ? "Saving…" : "Save role"}
          </button>
          {roleSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved!</span>
          )}
        </div>
        {roleError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{roleError}</p>
        )}
        {isInstructor && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Instructors can view and edit courses they are assigned to, but cannot create new courses or access admin functions.
          </p>
        )}
      </div>

      {/* Course assignments — only meaningful for instructors */}
      {isInstructor && (
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Assigned Courses
          </h3>

          {/* Assign new course */}
          <div className="flex items-center gap-2 mb-4">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              aria-label="Select course to assign"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a course…</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignCourse}
              disabled={!selectedCourseId || assigning}
              aria-label="Assign course"
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {assigning ? "Assigning…" : "Assign"}
            </button>
          </div>

          {courseError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{courseError}</p>
          )}

          {assignedCourses.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No courses assigned yet.
            </p>
          ) : (
            <div className="space-y-2">
              {assignedCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-[#2e2e3a] bg-gray-50 dark:bg-[#18181f] px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {course.status} · assigned {new Date(course.assignedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnassignCourse(course.id)}
                    disabled={unassigningId === course.id}
                    aria-label={`Remove ${course.title} assignment`}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    {unassigningId === course.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
