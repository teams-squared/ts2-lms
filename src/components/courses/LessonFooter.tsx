"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { CourseCompletionModal } from "@/components/courses/CourseCompletionModal";

interface CourseStats {
  totalLessons: number;
  completedLessons: number;
  xpEarned: number;
  daysTaken: number;
}

interface LessonFooterProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  /** 1-based index of the current lesson across the whole course. */
  currentIndex: number;
  totalLessons: number;
  /** Rounded 0–100 percentage of course completion. */
  percentComplete: number;
  prevLessonUrl: string | null;
  nextLessonUrl: string | null;
  initialCompleted: boolean;
  /** Title of the course, used in the completion modal. */
  courseTitle: string;
  /**
   * When true (e.g. quiz lessons) the Mark-complete button is suppressed — the
   * quiz flow handles completion on its own. A static "Complete" pill is shown
   * if completed.
   */
  hideMarkComplete?: boolean;
  /**
   * When true, the course's enrollment is locked at completed. The button
   * cluster is replaced with a static "Course completed" badge — the learner
   * can still navigate Prev/Next for review but can't mark / unmark anything.
   * Only an admin reset reopens the course.
   */
  courseLocked?: boolean;
  /**
   * For POLICY_DOC lessons: gates the Mark-complete button until the learner
   * scrolls to the bottom of the document. PolicyDocViewer fires a window
   * CustomEvent `policy-doc-acknowledgeable` with `{ lessonId }` when its
   * sentinel intersects the viewport. If the lesson is already completed
   * (re-visit), the gate is bypassed.
   */
  requireScrollToComplete?: boolean;
  /**
   * Custom CTA label for the Mark-complete button. POLICY_DOC lessons use
   * "Acknowledge" / "Saving acknowledgement…" instead of "Mark complete" to
   * make the audit framing explicit.
   */
  completeLabel?: string;
}

/**
 * Sticky lesson footer — design-system §8.7.1.
 *
 * 64px tall, `bg-background`, top border, sits below the scrollable lesson
 * body. Contains: Previous link · position + thin course progress bar ·
 * Mark-complete + Next link.
 */
export function LessonFooter({
  courseId,
  moduleId,
  lessonId,
  currentIndex,
  totalLessons,
  percentComplete,
  prevLessonUrl,
  nextLessonUrl,
  initialCompleted,
  courseTitle,
  hideMarkComplete = false,
  courseLocked = false,
  requireScrollToComplete = false,
  completeLabel,
}: LessonFooterProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  // Scroll-gate: enabled when (a) the lesson doesn't require scroll, (b)
  // the lesson was already completed (re-visit), or (c) the PolicyDocViewer
  // has fired its sentinel-intersection event for THIS lesson.
  const [scrollUnlocked, setScrollUnlocked] = useState(
    !requireScrollToComplete || initialCompleted,
  );

  useEffect(() => {
    if (!requireScrollToComplete || scrollUnlocked) return;
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ lessonId?: string }>).detail;
      if (detail?.lessonId === lessonId) {
        setScrollUnlocked(true);
      }
    }
    window.addEventListener("policy-doc-acknowledgeable", handler);
    return () => window.removeEventListener("policy-doc-acknowledgeable", handler);
  }, [requireScrollToComplete, scrollUnlocked, lessonId]);

  const endpoint = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/complete`;

  async function handleMarkComplete() {
    setIsLoading(true);
    // Optimistic: flip immediately, revert on failure
    setIsCompleted(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        courseComplete?: boolean;
        courseStats?: CourseStats | null;
      };
      toast("Lesson marked complete");
      router.refresh();
      if (data.courseComplete && data.courseStats) {
        setCourseStats(data.courseStats);
        setModalOpen(true);
      }
    } catch {
      setIsCompleted(false);
      toast("Could not mark complete — try again", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkIncomplete() {
    setIsLoading(true);
    setIsCompleted(false);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("Lesson marked incomplete", "info");
      router.refresh();
    } catch {
      setIsCompleted(true);
      toast("Could not undo — try again", "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {courseStats && (
        <CourseCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          courseId={courseId}
          courseTitle={courseTitle}
          stats={courseStats}
        />
      )}

      <footer className="sticky bottom-0 z-30 flex h-16 shrink-0 items-center gap-3 border-t border-border bg-background px-4 sm:px-6">
        {/* Previous */}
        {prevLessonUrl ? (
          <Link
            href={prevLessonUrl}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-foreground-muted",
              "transition-colors hover:bg-surface-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </Link>
        ) : (
          <div className="w-[88px]" aria-hidden="true" />
        )}

        {/* Center: position + course progress bar */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <p className="text-xs font-medium tabular-nums text-foreground-muted">
            Lesson {currentIndex} of {totalLessons}
          </p>
          <div
            className="relative h-1 w-full max-w-[320px] overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Course progress"
            aria-valuenow={percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Right: Mark complete + Next */}
        <div className="flex items-center gap-2">
          {courseLocked ? (
            <span
              data-testid="course-locked-badge"
              title="Course completed — ask an admin to reset progress to retake."
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-success-subtle px-3 py-2 text-sm font-medium text-success",
              )}
            >
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Course completed</span>
            </span>
          ) : !hideMarkComplete && (
            isCompleted ? (
              <button
                type="button"
                onClick={() => void handleMarkIncomplete()}
                disabled={isLoading}
                data-testid="mark-incomplete-button"
                aria-label="Mark this lesson incomplete"
                title="Click to mark incomplete"
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-success",
                  "transition-colors hover:bg-success-subtle disabled:cursor-not-allowed disabled:opacity-60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  <span className="group-hover:hidden">Completed</span>
                  <span className="hidden group-hover:inline">Mark incomplete</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleMarkComplete()}
                disabled={isLoading || !scrollUnlocked}
                data-testid="mark-complete-button"
                title={
                  !scrollUnlocked
                    ? "Scroll to the bottom of the document to enable"
                    : undefined
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {isLoading ? (
                  <Spinner size="sm" className="border-primary-foreground border-t-transparent" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {isLoading
                    ? completeLabel
                      ? `Saving ${completeLabel.toLowerCase()}…`
                      : "Saving…"
                    : completeLabel ?? "Mark complete"}
                </span>
              </button>
            )
          )}

          {nextLessonUrl ? (
            <Link
              href={nextLessonUrl}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 py-2 text-sm font-medium text-foreground",
                "transition-colors hover:bg-surface-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <div className="w-[68px]" aria-hidden="true" />
          )}
        </div>
      </footer>
    </>
  );
}
