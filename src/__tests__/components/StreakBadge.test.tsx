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

  it("renders fire emoji with role='img' and aria-label='fire'", () => {
    render(<StreakBadge streak={3} />);
    const emoji = screen.getByRole("img", { name: "fire" });
    expect(emoji).toBeInTheDocument();
    expect(emoji).toHaveTextContent("🔥");
  });

  it("renders '1-day streak' for streak=1", () => {
    render(<StreakBadge streak={1} />);
    expect(screen.getByText("1-day streak")).toBeInTheDocument();
  });
});
