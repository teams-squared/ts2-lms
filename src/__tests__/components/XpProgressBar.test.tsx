import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { XpProgressBar } from "@/components/gamification/XpProgressBar";

describe("XpProgressBar", () => {
  it("renders 'Level 1' for xp=50", () => {
    render(<XpProgressBar xp={50} />);
    expect(screen.getByText("Level 1")).toBeInTheDocument();
  });

  it("renders '50 / 100 XP' for xp=50", () => {
    render(<XpProgressBar xp={50} />);
    expect(screen.getByText("50 / 100 XP")).toBeInTheDocument();
  });

  it("renders total XP with locale formatting for xp=1500", () => {
    render(<XpProgressBar xp={1500} />);
    expect(screen.getByText("1,500 XP total")).toBeInTheDocument();
  });

  it("renders level 1 defaults for xp=0", () => {
    render(<XpProgressBar xp={0} />);
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("0 / 100 XP")).toBeInTheDocument();
  });

  it("progress bar width is '50%' for xp=50", () => {
    const { container } = render(<XpProgressBar xp={50} />);
    const innerBar = container.querySelector("[style]") as HTMLElement;
    expect(innerBar).not.toBeNull();
    expect(innerBar.style.width).toBe("50%");
  });
});
