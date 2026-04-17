"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Circle, PlayCircle, FileText, ClipboardList } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * LessonOutline — design-system Section 8.7 (lesson player left rail).
 *
 * Collapsible per-module list. The active lesson is highlighted with
 * `bg-primary-subtle` and a 3px `bg-primary` accent bar on the left edge
 * (matches the sidebar-active pattern in Section 8.6).
 *
 * Completed lessons show a solid check; in-progress shows a play triangle;
 * unvisited shows an empty circle. Quiz/doc icons differentiate type.
 */

export type LessonKind = "text" | "video" | "document" | "quiz"

export interface OutlineLesson {
  id: string
  title: string
  href: string
  kind: LessonKind
  completed?: boolean
  /** Exactly one lesson in the outline should be marked active. */
  active?: boolean
}

export interface OutlineModule {
  id: string
  title: string
  lessons: OutlineLesson[]
}

interface LessonOutlineProps {
  modules: OutlineModule[]
  className?: string
}

const KIND_ICON: Record<LessonKind, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  video: PlayCircle,
  document: FileText,
  quiz: ClipboardList,
}

export function LessonOutline({ modules, className }: LessonOutlineProps) {
  return (
    <nav aria-label="Lesson outline" className={cn("flex flex-col gap-4", className)}>
      {modules.map((mod, i) => (
        <section key={mod.id} className="flex flex-col gap-1">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
            <span className="mr-2 tabular-nums">{i + 1}.</span>
            {mod.title}
          </h3>
          <ul className="flex flex-col">
            {mod.lessons.map((lesson) => {
              const Icon = lesson.completed ? CheckCircle2 : KIND_ICON[lesson.kind] ?? Circle
              return (
                <li key={lesson.id}>
                  <Link
                    href={lesson.href}
                    aria-current={lesson.active ? "page" : undefined}
                    className={cn(
                      "relative flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      lesson.active &&
                        "bg-primary-subtle text-primary-subtle-foreground font-medium before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
                      lesson.completed && !lesson.active && "text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        lesson.completed ? "text-success" : "text-foreground-subtle",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 leading-5">{lesson.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
