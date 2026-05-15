import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? reduced : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  setReducedMotion(false);
  vi.useFakeTimers();
  // jsdom's rAF in fake-timer mode advances via the timer queue.
  let lastTime = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    lastTime += 16;
    return setTimeout(() => cb(lastTime), 16) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    clearTimeout(id as unknown as NodeJS.Timeout),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AnimatedNumber", () => {
  it("renders nothing when value is null", () => {
    const { container } = render(<AnimatedNumber value={null} />);
    expect(container.textContent).toBe("");
  });

  it("renders the rounded value as final text after the tween completes", () => {
    const { container } = render(<AnimatedNumber value={100} duration={300} />);
    // Drive the rAF tween to completion.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.textContent).toBe("100");
  });

  it("applies the supplied format function to in-flight values", () => {
    const { container } = render(
      <AnimatedNumber
        value={42}
        duration={200}
        format={(n) => `${Math.round(n)} XP`}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.textContent).toBe("42 XP");
  });

  it("skips the rAF tween entirely under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<AnimatedNumber value={250} duration={2000} />);
    // No timers advanced — value should be present immediately.
    expect(container.textContent).toBe("250");
  });

  it("includes tabular-nums so digit width is stable", () => {
    const { container } = render(<AnimatedNumber value={7} />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("tabular-nums");
  });

  it("forwards extra className", () => {
    const { container } = render(
      <AnimatedNumber value={1} className="text-primary font-semibold" />,
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-primary");
    expect(span?.className).toContain("font-semibold");
  });
});
