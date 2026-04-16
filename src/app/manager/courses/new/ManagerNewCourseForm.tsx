"use client";

import { useRouter } from "next/navigation";
import { CourseForm } from "@/components/courses/CourseForm";
import type { NodeTreeItem } from "@/components/courses/NodeTreeSelect";
import { useToast } from "@/components/ui/ToastProvider";
import type { CourseStatus } from "@/lib/types";

export function ManagerNewCourseForm({ nodeTree }: { nodeTree: NodeTreeItem[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
    nodeId: string | null;
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
    <CourseForm
      onSubmit={handleSubmit}
      onCancel={() => router.push("/manager")}
      nodeTree={nodeTree}
    />
  );
}
