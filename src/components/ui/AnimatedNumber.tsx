"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  /** The target value. `null` renders nothing — do not show `0` mid-load. */
  value: number | null;
  /** Optional formatter applied to the in-flight tween, not just the final value. */
  format?: (n: number) => string;
  /** Tween duration in ms. Default 600. */
  duration?: number;
  className?: string;
}

/**
 * Count-up number primitive — design-system §9.8.
 *
 * Tweens from the previous real value to the new value over `duration` ms
 * with an ease-out curve. Receives in-flight values through `format` so
 * formatted strings (durations, percentages) animate alongside the number.
 *
 * Reduced-motion users get the final value immediately — both the CSS
 * kill-switch and an explicit JS check, since rAF loops aren't covered
 * by the global transition-duration rule.
 *
 * Uses `tabular-nums` so digits don't shift width as they tick.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 600,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState<number | null>(value);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(value ?? 0);
  const rafRef = useRef<number>(0);
  const prevValueRef = useRef<number | null>(value);

  useEffect(() => {
    // These setDisplay calls fire synchronously inside the effect — they are
    // one-shot resets (clear / reduced-motion short-circuit / no-op when the
    // target equals the previous value). The cascading-render concern that
    // motivates `react-hooks/set-state-in-effect` doesn't apply here: each
    // path returns immediately and the next render is the final one.
    if (value === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(null);
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    // Tween from the previous real value (or 0 if first arrival).
    const from = prevValueRef.current ?? 0;
    const to = value;
    if (from === to) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(to);
      return;
    }
    fromRef.current = from;
    startRef.current = null;

    function tick(t: number) {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (to - fromRef.current) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prevValueRef.current = to;
      }
    }
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  if (display === null) return null;

  const text = format ? format(display) : Math.round(display).toString();
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
