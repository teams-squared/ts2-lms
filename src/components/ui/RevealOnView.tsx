"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealOnViewProps {
  children: ReactNode;
  /** ms to wait after element enters viewport before triggering. Use to stagger siblings. */
  delay?: number;
  /** IntersectionObserver threshold. 0.15 = trigger when 15% visible. */
  threshold?: number;
  className?: string;
  /** Override the default tag. Defaults to `div`. */
  as?: "div" | "section" | "article" | "li";
}

/**
 * One-shot entrance reveal for content as it scrolls into view.
 *
 * Adds opacity 0 → 1 and a small Y rise (8px) over 220ms `ease-out-expo`
 * the first time the element crosses the viewport threshold. Disconnects
 * the observer after firing so there's no continuous coupling to scroll
 * position (distinct from parallax — see design-system §9.4 carve-out).
 *
 * Honors `prefers-reduced-motion`: reduced-motion users see fully revealed
 * content on mount with no animation.
 */
export function RevealOnView({
  children,
  delay = 0,
  threshold = 0.15,
  className,
  as: Tag = "div",
}: RevealOnViewProps) {
  const ref = useRef<HTMLElement | null>(null);
  // Lazy initializer reads the reduced-motion preference once at mount so the
  // first render already returns the revealed state — avoids a cascading
  // setState inside the observer-wiring effect below.
  const [shown, setShown] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  });

  useEffect(() => {
    // Already revealed (either by reduced-motion at mount or by a prior
    // observer fire) — nothing to wire up.
    if (shown) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delay > 0) {
              window.setTimeout(() => setShown(true), delay);
            } else {
              setShown(true);
            }
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, threshold, shown]);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-reveal motion-safe:ease-out-expo",
        shown
          ? "opacity-100 translate-y-0"
          : "motion-safe:opacity-0 motion-safe:translate-y-2",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
