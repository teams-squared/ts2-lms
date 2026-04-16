"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CourseForm } from "@/components/courses/CourseForm";
import { useToast } from "@/components/ui/ToastProvider";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { CourseStatus } from "@/lib/types";

export default function ManagerNewCoursePage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
  }) => {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Failed to create course");
    }
    const course = (await res.json()) as { id: string };
    toast("Course created");
    router.push(`/manager/courses/${course.id}/edit`);
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Manager", href: "/manager" },
          { label: "New Course" },
        ]}
      />
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Create New Course
      </h1>
      <div className="max-w-lg">
        <CourseForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/manager")}
        />
      </div>
    </div>
  );
}
