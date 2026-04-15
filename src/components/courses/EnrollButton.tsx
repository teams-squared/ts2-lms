"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { ChevronRightIcon } from "@/components/icons";

interface EnrollButtonProps {
  courseId: string;
  isLocked: boolean;
  enrolled: boolean;
  isComplete: boolean;
  /** URL of the very first lesson in the course. Null when course has no lessons. */
  firstLessonUrl: string | null;
  /** URL of the first incomplete lesson (for enrolled, in-progress users). */
  continueUrl: string | null;
}

/**
 * Primary course call-to-action.
 * - Not enrolled + unlocked → "Enroll & Start Learning" button (calls enroll API then navigates)
 * - Enrolled + in progress  → "Continue Learning" link
 * - Enrolled + complete     → "Review Course" link
 * - Locked / no lessons     → renders nothing (lock banner handles the locked state)
 */
export function EnrollButton({
  courseId,
  isLocked,
  enrolled,
  isComplete,
  firstLessonUrl,
  continueUrl,
}: EnrollButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLocked || !firstLessonUrl) return null;

  if (enrolled) {
    const href = isComplete ? firstLessonUrl : (continueUrl ?? firstLessonUrl);
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold px-5 py-3 transition-colors shadow-sm shadow-brand-600/20 mb-4"
      >
        {isComplete ? "Review Course" : "Continue Learning"}
        <ChevronRightIcon className="w-4 h-4" />
      </Link>
    );
  }

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to enroll. Please try again.");
        return;
      }
      router.push(firstLessonUrl);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => void handleEnroll()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 transition-colors shadow-sm shadow-brand-600/20"
      >
        {loading ? (
          <>
            <Spinner size="sm" className="border-white border-t-transparent" />
            Enrolling…
          </>
        ) : (
          <>
            Enroll &amp; Start Learning
            <ChevronRightIcon className="w-4 h-4" />
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
