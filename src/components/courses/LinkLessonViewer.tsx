"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { LessonTitleHeader } from "./LessonTitleHeader";
import { Button } from "@/components/ui/button";
import { parseLinkContent } from "@/lib/lesson-link";

/** Window event the LessonFooter listens for to unlock its Mark-complete
 *  CTA. Reused from the policy-doc viewer; the prop name in
 *  LessonFooter is generic ("content engaged"), the event name is
 *  historic. */
const UNLOCK_EVENT = "policy-doc-acknowledgeable";

interface LinkLessonViewerProps {
  lessonId: string;
  title: string;
  content: string | null;
  /** When true, the lesson is already complete (re-visit). Pre-fire the
   *  unlock event on mount so Mark-complete stays enabled even if the
   *  learner doesn't re-click "Open article". */
  alreadyCompleted?: boolean;
}

/**
 * Renderer for `LessonType.LINK` lessons — a single external article /
 * blog post. Shows a card with the lesson title, hostname, optional
 * blurb, and an "Open article ↗" CTA. Clicking the CTA opens the URL
 * in a new tab AND dispatches a window event that unlocks the standard
 * Mark-complete button in the lesson footer. Click + complete is
 * recorded as an ordinary `LessonProgress` row.
 *
 * No completion gate beyond the click: we can't observe time spent on
 * a third-party site. PolicyDocLesson remains the authority for
 * compliance-sensitive "required reading" evidence.
 */
export function LinkLessonViewer({
  lessonId,
  title,
  content,
  alreadyCompleted = false,
}: LinkLessonViewerProps) {
  const link = parseLinkContent(content);

  // Re-visit: fire unlock immediately so the Mark-complete button stays
  // enabled without requiring another click on "Open article".
  useEffect(() => {
    if (!alreadyCompleted || !lessonId) return;
    window.dispatchEvent(
      new CustomEvent(UNLOCK_EVENT, { detail: { lessonId } }),
    );
  }, [alreadyCompleted, lessonId]);

  if (!link) {
    return (
      <div>
        <LessonTitleHeader title={title} type="link" />
        <p className="text-sm text-foreground-muted">
          No article URL configured. Edit the lesson to add one.
        </p>
      </div>
    );
  }

  let hostname = "";
  try {
    hostname = new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    hostname = link.url;
  }

  function handleOpen() {
    if (!lessonId) return;
    window.dispatchEvent(
      new CustomEvent(UNLOCK_EVENT, { detail: { lessonId } }),
    );
  }

  return (
    <div>
      <LessonTitleHeader title={title} type="link" />

      <section
        aria-label="External article"
        className="rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-start gap-3">
          <ExternalLink
            className="h-5 w-5 flex-shrink-0 text-primary mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-foreground-muted">
              {hostname}
            </p>
            <p className="mt-0.5 font-semibold text-foreground break-words">
              {title}
            </p>
            {link.blurb && (
              <p className="mt-2 text-sm text-foreground-muted">
                {link.blurb}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={handleOpen}
            >
              Open article
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
          {!alreadyCompleted && (
            <p className="text-xs text-foreground-muted">
              Opening the article unlocks Mark complete.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
