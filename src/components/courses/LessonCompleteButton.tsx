"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@/components/icons";

interface LessonCompleteButtonProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  initialCompleted: boolean;
}

export function LessonCompleteButton({
  courseId,
  moduleId,
  lessonId,
  initialCompleted,
}: LessonCompleteButtonProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkComplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/complete`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to mark complete");
      }
      setIsCompleted(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCompleted) {
    return (
      <div
        className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
        data-testid="lesson-completed-state"
      >
        <CheckCircleIcon className="w-5 h-5" />
        Lesson complete
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleMarkComplete}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        data-testid="mark-complete-button"
      >
        {isLoading ? "Saving…" : "Mark complete"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" data-testid="complete-error">
          {error}
        </p>
      )}
    </div>
  );
}
