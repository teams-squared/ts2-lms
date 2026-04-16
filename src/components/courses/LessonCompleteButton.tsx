"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";

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
  const { toast } = useToast();
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/complete`;

  async function handleMarkComplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to mark complete");
      }
      setIsCompleted(true);
      toast("Lesson marked complete");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkIncomplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to unmark complete");
      }
      setIsCompleted(false);
      toast("Lesson marked incomplete", "info");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col items-start gap-1" data-testid="lesson-completed-state">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircleIcon className="w-5 h-5" />
          Lesson complete
        </div>
        <button
          onClick={handleMarkIncomplete}
          disabled={isLoading}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
          data-testid="mark-incomplete-button"
        >
          {isLoading ? "Saving…" : "Mark as incomplete"}
        </button>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400" data-testid="complete-error">
            {error}
          </p>
        )}
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
        {isLoading ? <><Spinner size="sm" className="border-white border-t-transparent" /> Saving…</> : "Mark complete"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" data-testid="complete-error">
          {error}
        </p>
      )}
    </div>
  );
}
