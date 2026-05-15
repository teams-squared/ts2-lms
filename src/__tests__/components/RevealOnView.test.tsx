import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { RevealOnView } from "@/components/ui/RevealOnView";

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;
let lastObserver: {
  cb: ObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} | null = null;

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
  lastObserver = null;
  // Capture every constructed observer so individual tests can drive
  // the `isIntersecting` callback manually. Must be a constructable class —
  // `new IntersectionObserver(...)` won't accept a plain function.
  class FakeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn();
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
    constructor(cb: ObserverCallback) {
      lastObserver = { cb, observe: this.observe, disconnect: this.disconnect };
    }
  }
  window.IntersectionObserver =
    FakeObserver as unknown as typeof window.IntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RevealOnView", () => {
  it("renders children at rest in a hidden state", () => {
    const { container } = render(
      <RevealOnView>
        <p>hello</p>
      </RevealOnView>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("motion-safe:opacity-0");
    expect(wrapper.textContent).toBe("hello");
  });

  it("reveals immediately under reduced motion (no IntersectionObserver wait)", () => {
    setReducedMotion(true);
    const { container } = render(
      <RevealOnView>
        <p>hello</p>
      </RevealOnView>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("opacity-100");
    // Observer must not even have been constructed under reduced motion.
    expect(lastObserver).toBeNull();
  });

  it("reveals when the observer fires with isIntersecting=true", () => {
    const { container } = render(
      <RevealOnView>
        <p>hello</p>
      </RevealOnView>,
    );
    expect(lastObserver).not.toBeNull();
    act(() => {
      lastObserver!.cb([{ isIntersecting: true } as IntersectionObserverEntry]);
    });
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("opacity-100");
    expect(lastObserver!.disconnect).toHaveBeenCalled();
  });

  it("honors the delay prop before flipping shown", () => {
    vi.useFakeTimers();
    const { container } = render(
      <RevealOnView delay={120}>
        <p>hello</p>
      </RevealOnView>,
    );
    act(() => {
      lastObserver!.cb([{ isIntersecting: true } as IntersectionObserverEntry]);
    });
    // Immediately after observer fire: still hidden (delay not yet elapsed).
    let wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("motion-safe:opacity-0");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("opacity-100");
    vi.useRealTimers();
  });

  it("renders with the supplied tag (as prop)", () => {
    const { container } = render(
      <RevealOnView as="section">
        <p>hello</p>
      </RevealOnView>,
    );
    expect(container.firstChild?.nodeName).toBe("SECTION");
  });

  it("ignores observer entries that are not intersecting", () => {
    const { container } = render(
      <RevealOnView>
        <p>hello</p>
      </RevealOnView>,
    );
    act(() => {
      lastObserver!.cb([{ isIntersecting: false } as IntersectionObserverEntry]);
    });
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("motion-safe:opacity-0");
    expect(lastObserver!.disconnect).not.toHaveBeenCalled();
  });
});
