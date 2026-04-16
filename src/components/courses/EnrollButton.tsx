"use client";

import Link from "next/link";
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
 * Primary course call-to-action (enrolled users only).
 * - Enrolled + in progress  → "Continue Learning" link
 * - Enrolled + complete     → "Review Course" link
 * - Not enrolled / locked / no lessons → renders nothing
 */
export function EnrollButton({
  isLocked,
  enrolled,
  isComplete,
  firstLessonUrl,
  continueUrl,
}: EnrollButtonProps) {
  if (isLocked || !firstLessonUrl || !enrolled) return null;

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
