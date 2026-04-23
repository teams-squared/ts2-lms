import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakBadge } from "@/components/gamification/StreakBadge";

describe("StreakBadge", () => {
  it("returns null when streak=0", () => {
    const { container } = render(<StreakBadge streak={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders '5-day streak' for streak=5", () => {
    render(<StreakBadge streak={5} />);
    expect(screen.getByText("5-day streak")).toBeInTheDocument();
  });

  it("renders a decorative streak indicator (not an emoji)", () => {
    const { container } = render(<StreakBadge streak={3} />);
    // The streak indicator is a decorative dot, aria-hidden. Assert it
    // exists and that no emoji text content leaks into the badge.
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(container.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("renders '1-day streak' for streak=1", () => {
    render(<StreakBadge streak={1} />);
    expect(screen.getByText("1-day streak")).toBeInTheDocument();
  });
});
