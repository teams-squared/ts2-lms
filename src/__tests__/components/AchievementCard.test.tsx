import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AchievementCard } from "@/components/gamification/AchievementCard";

describe("AchievementCard", () => {
  const unlockedProps = {
    icon: "trophy",
    title: "First Win",
    description: "Complete your first course",
    unlockedAt: "2026-01-15T00:00:00.000Z",
  };

  const lockedProps = {
    icon: "trophy",
    title: "First Win",
    description: "Complete your first course",
    unlockedAt: null,
  };

  it("renders icon, title, and description when unlocked", () => {
    const { container } = render(<AchievementCard {...unlockedProps} />);
    // Icon is rendered as a lucide component (svg), labelled by the
    // achievement title. Assert the aria-label is set and that no emoji
    // text content leaks into the card.
    expect(screen.getByRole("img", { name: "First Win" })).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
    expect(screen.getByText("First Win")).toBeInTheDocument();
    expect(screen.getByText("Complete your first course")).toBeInTheDocument();
  });

  it("renders unlocked date for unlockedAt='2026-01-15T00:00:00.000Z'", () => {
    render(<AchievementCard {...unlockedProps} />);
    const dateParagraph = screen.getByText(/Unlocked/);
    expect(dateParagraph).toBeInTheDocument();
    // The date text should contain a formatted date string
    expect(dateParagraph.textContent).toMatch(/Unlocked\s+\d/);
  });

  it("renders lock icon when unlockedAt is null", () => {
    const { container } = render(<AchievementCard {...lockedProps} />);
    // LockIcon is decorative (aria-hidden) — assert by class hook
    expect(container.querySelector(".lucide-lock")).toBeInTheDocument();
  });

  it("does not render unlock date when locked", () => {
    render(<AchievementCard {...lockedProps} />);
    expect(screen.queryByText(/Unlocked/)).not.toBeInTheDocument();
  });

  it("applies opacity-50 class when locked", () => {
    const { container } = render(<AchievementCard {...lockedProps} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("opacity-50");
  });

  it("does not have opacity-50 when unlocked", () => {
    const { container } = render(<AchievementCard {...unlockedProps} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("opacity-50");
  });
});
