import { FileText, Film, HelpCircle, Monitor, ShieldCheck, Type } from "lucide-react";
import type { LessonType } from "@/lib/types";

interface LessonTitleHeaderProps {
  title: string;
  type: LessonType;
  /** Optional: readable estimated duration, e.g. "5 min read" or "12 min". */
  estimate?: string | null;
  /** Optional: format label override, e.g. "PDF document". */
  formatLabel?: string | null;
}

const TYPE_LABEL: Record<LessonType, string> = {
  text: "Reading",
  video: "Video",
  document: "Document",
  quiz: "Quiz",
  html: "Interactive",
  policy_doc: "Policy document",
};

const TYPE_ICON: Record<LessonType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  video: Film,
  document: FileText,
  quiz: HelpCircle,
  html: Monitor,
  policy_doc: ShieldCheck,
};

/**
 * Lesson title + meta row — design-system §8.7.2.
 *
 * - Title: `text-3xl font-display font-semibold tracking-tight`
 * - Meta row: icon + format label · optional time estimate, in `text-foreground-muted`.
 */
export function LessonTitleHeader({
  title,
  type,
  estimate,
  formatLabel,
}: LessonTitleHeaderProps) {
  const Icon = TYPE_ICON[type];
  const label = formatLabel ?? TYPE_LABEL[type];

  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <div className="mt-2 flex items-center gap-2 text-sm text-foreground-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
        {estimate && (
          <>
            <span aria-hidden="true">·</span>
            <span>{estimate}</span>
          </>
        )}
      </div>
    </header>
  );
}

/** Estimate reading time for text/markdown: ~200 words per minute, min 1. */
export function estimateReadingMinutes(content: string | null | undefined): number {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
