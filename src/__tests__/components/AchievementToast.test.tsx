import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AchievementToast } from "@/components/gamification/AchievementToast";

describe("AchievementToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const achievements = [
    { key: "first-lesson", title: "First Lesson", icon: "book" },
    { key: "streak-7", title: "Week Warrior", icon: "flame" },
  ];

  it("returns null when achievements is empty array", () => {
    const { container } = render(<AchievementToast achievements={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders each achievement title and 'Achievement Unlocked!' text", () => {
    render(<AchievementToast achievements={[achievements[0]]} />);
    expect(screen.getByText("First Lesson")).toBeInTheDocument();
    expect(screen.getByText("Achievement Unlocked!")).toBeInTheDocument();
  });

  it("renders multiple achievements with both titles visible", () => {
    render(<AchievementToast achievements={achievements} />);
    expect(screen.getByText("First Lesson")).toBeInTheDocument();
    expect(screen.getByText("Week Warrior")).toBeInTheDocument();
  });

  it("auto-dismisses after 5 seconds", () => {
    const { container } = render(<AchievementToast achievements={[achievements[0]]} />);
    expect(screen.getByText("First Lesson")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(container.innerHTML).toBe("");
  });

  it("calls onDismiss callback after auto-dismiss", () => {
    const onDismiss = vi.fn();
    render(<AchievementToast achievements={[achievements[0]]} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
