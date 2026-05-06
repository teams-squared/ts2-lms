"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  HamburgerIcon,
  CloseIcon,
  DocumentTextIcon,
  VideoIcon,
  QuizIcon,
  PaperclipIcon,
  LayoutGridIcon,
  ClockIcon,
  ShieldIcon,
  LinkIcon,
} from "@/components/icons";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { LessonType } from "@/lib/types";
import type { DeadlineInfo } from "@/lib/deadlines";

/**
 * Course-lesson sidebar — design-system §8.7.3.
 *
 * On lesson pages the lesson content is the focus, so by default the
 * sidebar lives as a 64px rail and expands to 288px on hover or keyboard
 * focus via a fixed overlay (no reflow of the lesson body). A pin toggle
 * at the bottom switches to the classic in-flow 288px rail; preference
 * persists in localStorage under "course-sidebar-pinned".
 *
 * Mirrors the pattern used by the app shell Sidebar so the two behave
 * consistently.
 */

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

const LESSON_TYPE_ICON: Record<LessonType, React.FC<{ className?: string }>> = {
  text: DocumentTextIcon,
  video: VideoIcon,
  quiz: QuizIcon,
  document: PaperclipIcon,
  html: LayoutGridIcon,
  policy_doc: ShieldIcon,
  link: LinkIcon,
};

export function CourseSidebar({
  modules,
  courseId,
  currentLessonId,
  courseTitle,
  completedLessonIds = new Set(),
  percentComplete = 0,
  deadlineInfoMap,
}: {
  modules: Module[];
  courseId: string;
  currentLessonId: string;
  courseTitle: string;
  completedLessonIds?: Set<string>;
  percentComplete?: number;
  deadlineInfoMap?: Record<string, DeadlineInfo>;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  // Restore pin state from localStorage on first mount.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("course-sidebar-pinned");
      if (stored === "true") setPinned(true);
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("course-sidebar-pinned", String(pinned));
    } catch {
      /* ignore */
    }
  }, [pinned, mounted]);

  // When `collapsible` is true (unpinned mode), chrome elements (back link,
  // course title, progress bar, module headers, pin label) hide entirely
  // via display:none and re-appear on hover/focus-within. Lesson icons stay
  // visible always so the rail stays scannable; their text labels fade in.
  const collapsible = !pinned;
  const chromeBlockCls = collapsible
    ? "hidden group-hover:block group-focus-within:block"
    : "";
  const labelCls = collapsible
    ? "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    : "";

  const sidebarContent = (
    <>
      {/* Back to course + course title — hidden entirely when collapsed so
          the rail starts cleanly with the lesson icons; appears on hover. */}
      <div
        className={`shrink-0 space-y-1 border-b border-border px-4 py-3 ${chromeBlockCls}`}
      >
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1 text-xs text-foreground-subtle transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Back to course</span>
        </Link>
        <h2 className="line-clamp-2 font-display text-base font-semibold text-foreground">
          {courseTitle}
        </h2>
      </div>

      {/* Progress bar — hidden when collapsed (the bar without a percent
          label was confusing); appears on hover. */}
      {totalLessons > 0 && (
        <div
          className={`shrink-0 border-b border-border px-4 py-2.5 ${chromeBlockCls}`}
          data-testid="progress-bar-container"
        >
          <div className="mb-1.5 flex justify-between text-xs text-foreground-muted">
            <span>Progress</span>
            <span data-testid="progress-percent">{percentComplete}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Course progress"
            aria-valuenow={percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
              style={{ width: `${percentComplete}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      )}

      {/* Module/Lesson navigation. When collapsed, modules are visually
          separated by a 1px divider (between groups, not before the first)
          so the icon clusters are interpretable without titles. */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Course lessons">
        {modules.map((mod, modIdx) => (
          <div
            key={mod.id}
            className={
              collapsible && modIdx > 0
                ? "mt-2 border-t border-border pt-2"
                : "mb-1"
            }
          >
            <div className={`px-4 py-2 ${chromeBlockCls}`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
                {mod.title}
              </span>
            </div>
            <div className="space-y-0.5">
              {mod.lessons.map((lesson) => {
                const isActive = lesson.id === currentLessonId;
                const isDone = completedLessonIds.has(lesson.id);
                const LessonIcon = LESSON_TYPE_ICON[lesson.type];
                const info = deadlineInfoMap?.[lesson.id];
                const showDeadlineBadge =
                  !isDone && info && (info.status === "overdue" || info.status === "due-soon");
                return (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseId}/lessons/${lesson.id}`}
                    onClick={() => setMobileOpen(false)}
                    title={lesson.title}
                    className={`relative mx-2 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      isActive
                        ? "bg-primary-subtle font-medium text-primary before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-primary"
                        : "text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <LessonIcon
                      className={`h-4 w-4 flex-shrink-0 ${
                        isActive ? "text-primary" : "text-foreground-subtle"
                      }`}
                    />
                    <span className={`line-clamp-1 flex-1 whitespace-nowrap ${labelCls}`}>
                      {lesson.title}
                    </span>
                    {showDeadlineBadge && (
                      <ClockIcon
                        className={`h-3.5 w-3.5 flex-shrink-0 ${labelCls} ${
                          info!.status === "overdue" ? "text-danger" : "text-warning"
                        }`}
                      />
                    )}
                    {isDone && (
                      <CheckCircleIcon
                        className={`h-4 w-4 flex-shrink-0 text-success ${labelCls}`}
                        aria-label="Completed"
                        data-testid={`completed-icon-${lesson.id}`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pin toggle — icon always visible, label fades in on hover. */}
      <div className="shrink-0 border-t border-border px-2 pt-2 pb-3">
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          aria-label={pinned ? "Unpin course navigation" : "Pin course navigation"}
          aria-pressed={pinned}
          title={pinned ? "Unpin course navigation" : "Pin course navigation"}
          className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {pinned ? (
            <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span className={`whitespace-nowrap ${labelCls}`}>
            {pinned ? "Unpin" : "Pin navigation"}
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover active:bg-primary-active lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Open course navigation"
      >
        <HamburgerIcon className="h-5 w-5" />
        <span className="sr-only sm:not-sr-only">Lessons</span>
      </button>

      {/* Mobile overlay sidebar — unchanged */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Course navigation"
        >
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="motion-safe:animate-slide-in-left relative w-80 max-w-[85vw] flex-shrink-0 overflow-y-auto bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">
                Course Navigation
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close course navigation"
              >
                <CloseIcon className="h-5 w-5 text-foreground-muted" />
              </button>
            </div>
            <div className="flex h-full flex-col">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar — pinned: classic in-flow 288px rail */}
      {pinned ? (
        <aside className="hidden w-72 flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card lg:flex">
          {sidebarContent}
        </aside>
      ) : (
        // Unpinned: 64px in-flow spacer + absolute overlay that expands
        // on hover/focus-within. The parent flex container has
        // `relative` so the overlay positions correctly within it.
        <>
          <div aria-hidden="true" className="hidden w-16 shrink-0 lg:block" />
          <aside
            className={
              "group hidden absolute left-0 top-0 z-30 h-full w-16 flex-col overflow-hidden border-r border-border bg-card transition-[width,box-shadow] duration-200 ease-out hover:w-72 hover:shadow-lg focus-within:w-72 focus-within:shadow-lg lg:flex"
            }
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
