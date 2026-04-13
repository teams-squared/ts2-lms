"use client";

import { useEffect, useState } from "react";
import { CourseForm } from "./CourseForm";
import { PlusIcon } from "@/components/icons";
import type { CourseStatus } from "@/lib/types";

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  status: CourseStatus;
  createdBy: { name: string | null; email: string };
  createdAt: string;
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export default function AdminCourseTable() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/admin/courses")
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load courses"
        );
        setLoading(false);
      });
  }, []);

  const handleCreate = async (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
  }) => {
    const course = await apiFetch<Course>("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setCourses((prev) => [course, ...prev]);
    setShowForm(false);
  };

  const handleUpdate = async (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
  }) => {
    if (!editingCourse) return;
    const updated = await apiFetch<Course>(`/api/courses/${editingCourse.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCourse(null);
  };

  const handleStatusChange = async (
    courseId: string,
    newStatus: CourseStatus
  ) => {
    setUpdatingStatus(courseId);
    setStatusError(null);
    try {
      const updated = await apiFetch<Course>(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch (err: unknown) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
        Loading courses…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400 py-8 text-center">
        {fetchError}
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Create New Course
        </h3>
        <CourseForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  if (editingCourse) {
    return (
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Edit Course
        </h3>
        <CourseForm
          initialData={editingCourse}
          onSubmit={handleUpdate}
          onCancel={() => setEditingCourse(null)}
          submitLabel="Save Changes"
        />
      </div>
    );
  }

  return (
    <div>
      {statusError && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
          {statusError}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {courses.length} course{courses.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New Course
        </button>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                Course
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                Author
              </th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {courses.map((course) => (
              <tr
                key={course.id}
                className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
              >
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {course.title}
                  </p>
                  {course.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {course.description}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <select
                    value={course.status}
                    onChange={(e) =>
                      handleStatusChange(course.id, e.target.value as CourseStatus)
                    }
                    disabled={updatingStatus === course.id}
                    aria-label={`Status for ${course.title}`}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {course.createdBy.name || course.createdBy.email}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setEditingCourse(course)}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
