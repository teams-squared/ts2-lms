"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { ProgressBar } from "@/components/app/ProgressBar";

/**
 * LessonPlayerShell — design-system Section 8.7.
 *
 * Three-column layout:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  Top bar (64px)                                            │
 *   ├─────────────┬──────────────────────────────┬───────────────┤
 *   │  outline    │  lesson content (max 760px)  │  side (opt.)  │
 *   │  (280px)    │                              │  (320px)      │
 *   ├─────────────┴──────────────────────────────┴───────────────┤
 *   │  Sticky bottom bar: [← Prev]  progress  [Next →]           │
 *   └────────────────────────────────────────────────────────────┘
 *
 * The content column maxes at 760px for reading discipline. No sidebar
 * gradients, no brand wallpaper — content is the figure per §8.7.
 */

interface LessonNavLink {
  href: string;
  label?: string; // default "Previous" / "Next lesson"
  disabled?: boolean;
}

interface LessonPlayerShellProps {
  /** Left rail — LessonOutline typically. */
  outline: React.ReactNode;
  /** Main content column. */
  children: React.ReactNode;
  /** Optional right rail (notes / transcript / resources). */
  side?: React.ReactNode;
  /** Sticky bottom-bar props. */
  prev?: LessonNavLink | null;
  next?: LessonNavLink | null;
  /** e.g. "Lesson 3 of 8" */
  progressLabel: string;
  /** 0..100 for the thin progress bar. */
  progressPercent: number;
  className?: string;
}

export function LessonPlayerShell({
  outline,
  children,
  side,
  prev,
  next,
  progressLabel,
  progressPercent,
  className,
}: LessonPlayerShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full flex-col bg-background text-foreground",
        className,
      )}
    >
      <TopBar compact />

      <div className="flex flex-1 min-h-0">
        {/* Left rail: module outline */}
        <aside
          aria-label="Module outline"
          className="hidden w-[280px] shrink-0 border-r border-border bg-surface lg:block"
        >
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto p-4">
            {outline}
          </div>
        </aside>

        {/* Main content — centered, capped at 760px */}
        <div className="flex flex-1 min-w-0 justify-center px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <article className="w-full max-w-[760px]">{children}</article>
        </div>

        {/* Right rail (optional) */}
        {side && (
          <aside
            aria-label="Lesson resources"
            className="hidden w-[320px] shrink-0 border-l border-border bg-surface xl:block"
          >
            <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto p-4">
              {side}
            </div>
          </aside>
        )}
      </div>

      {/* Sticky bottom nav */}
      <nav
        aria-label="Lesson navigation"
        className="sticky bottom-0 z-20 flex h-16 items-center gap-4 border-t border-border bg-background px-4 sm:px-6"
      >
        <div className="flex-1">
          {prev?.href ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              disabled={prev.disabled}
            >
              <Link href={prev.href}>
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                {prev.label ?? "Previous"}
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
          )}
        </div>

        <div className="hidden min-w-0 flex-1 flex-col items-center gap-1 sm:flex">
          <span className="text-xs text-foreground-muted tabular-nums">
            {progressLabel}
          </span>
          <ProgressBar
            value={progressPercent}
            label={progressLabel}
            size="sm"
            className="w-40"
          />
        </div>

        <div className="flex flex-1 justify-end">
          {next?.href ? (
            <Button asChild size="sm" disabled={next.disabled}>
              <Link href={next.href}>
                {next.label ?? "Next lesson"}
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled>
              Next lesson
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
