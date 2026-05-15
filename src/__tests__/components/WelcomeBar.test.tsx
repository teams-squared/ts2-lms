import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { WelcomeBar } from "@/components/dashboard/WelcomeBar";

beforeEach(() => {
  // Reduced motion → AnimatedNumber renders final value immediately,
  // so we can assert on text content without driving the rAF tween.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? true : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WelcomeBar", () => {
  it("renders the first-name subline", () => {
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={0} streak={0} />,
    );
    expect(container.textContent).toContain("Akil");
  });

  it("renders the level avatar with the calculated level", () => {
    // 0 XP = Level 1
    const { getByLabelText } = render(
      <WelcomeBar firstName="Akil" xp={0} streak={0} />,
    );
    const avatar = getByLabelText("Level 1");
    expect(avatar.textContent).toContain("1");
  });

  it("shows current / next-level XP in the meta row", () => {
    // 50 XP = Level 1, 50 / 100 (current xp / level-1 cap)
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={50} streak={0} />,
    );
    expect(container.textContent).toContain("50");
    expect(container.textContent).toContain("100 XP");
  });

  it("hides the streak indicator when streak is 0", () => {
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={0} streak={0} />,
    );
    expect(container.textContent).not.toContain("streak");
  });

  it("renders the streak indicator when streak > 0", () => {
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={0} streak={5} />,
    );
    expect(container.textContent).toContain("5-day streak");
  });

  it("exposes an aria-valuenow on the XP progress bar", () => {
    // 50 XP into level-1 (cap 100) → 50%
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={50} streak={0} />,
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-valuenow")).toBe("50");
    expect(bar?.getAttribute("aria-valuemin")).toBe("0");
    expect(bar?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("renders one of the rotating sublines (deterministic per hour)", () => {
    const { container } = render(
      <WelcomeBar firstName="Akil" xp={0} streak={0} />,
    );
    // Subline is always one of these six options.
    const expectedFragments = [
      "Keep it up",
      "Back at it",
      "Let's go",
      "Ready to learn",
      "Welcome back",
      "Make today count",
    ];
    expect(
      expectedFragments.some((f) => container.textContent?.includes(f)),
    ).toBe(true);
  });
});
