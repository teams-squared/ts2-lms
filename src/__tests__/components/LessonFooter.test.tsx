import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LessonFooter } from "@/components/courses/LessonFooter";

const baseProps = {
  courseId: "c-1",
  moduleId: "m-1",
  lessonId: "l-1",
  currentIndex: 3,
  totalLessons: 10,
  percentComplete: 30,
  prevLessonUrl: "/courses/c-1/lessons/prev",
  nextLessonUrl: "/courses/c-1/lessons/next",
  initialCompleted: false,
  courseTitle: "Course",
};

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

describe("LessonFooter", () => {
  it("renders Lesson N of M with the supplied index", () => {
    render(<LessonFooter {...baseProps} />);
    expect(screen.getByText("Lesson 3 of 10")).toBeInTheDocument();
  });

  it("renders the course progress bar with aria-valuenow", () => {
    render(<LessonFooter {...baseProps} percentComplete={42} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  it("renders Previous link only when prevLessonUrl is supplied", () => {
    const { rerender } = render(<LessonFooter {...baseProps} />);
    expect(screen.getByText("Previous").closest("a")?.getAttribute("href")).toBe(
      "/courses/c-1/lessons/prev",
    );
    rerender(<LessonFooter {...baseProps} prevLessonUrl={null} />);
    expect(screen.queryByText("Previous")).toBeNull();
  });

  it("renders Next link only when nextLessonUrl is supplied", () => {
    const { rerender } = render(<LessonFooter {...baseProps} />);
    expect(screen.getByText("Next").closest("a")?.getAttribute("href")).toBe(
      "/courses/c-1/lessons/next",
    );
    rerender(<LessonFooter {...baseProps} nextLessonUrl={null} />);
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("renders the Mark complete button and posts to the complete endpoint on click", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    render(<LessonFooter {...baseProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/c-1/modules/m-1/lessons/l-1/complete",
      { method: "POST" },
    );
  });

  it("renders the Completed button + Mark-incomplete affordance when initialCompleted", () => {
    render(<LessonFooter {...baseProps} initialCompleted />);
    expect(screen.getByTestId("mark-incomplete-button")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("DELETEs the complete record when Mark-incomplete is clicked", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);
    render(<LessonFooter {...baseProps} initialCompleted />);
    fireEvent.click(screen.getByTestId("mark-incomplete-button"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/c-1/modules/m-1/lessons/l-1/complete",
      { method: "DELETE" },
    );
  });

  it("hides Mark complete when hideMarkComplete is true (quiz lessons)", () => {
    render(<LessonFooter {...baseProps} hideMarkComplete />);
    expect(screen.queryByTestId("mark-complete-button")).toBeNull();
    expect(screen.queryByTestId("mark-incomplete-button")).toBeNull();
  });

  it("shows the static Course-completed badge when courseLocked is true", () => {
    render(<LessonFooter {...baseProps} courseLocked />);
    expect(screen.getByTestId("course-locked-badge")).toBeInTheDocument();
    // No Mark-complete or Next mutation surfaces in locked mode.
    expect(screen.queryByTestId("mark-complete-button")).toBeNull();
  });

  it("gates Mark complete behind the policy-doc attestation event", () => {
    render(
      <LessonFooter
        {...baseProps}
        requireScrollToComplete
        completeLabel="Acknowledge"
      />,
    );
    const btn = screen.getByTestId("mark-complete-button");
    expect(btn.hasAttribute("disabled")).toBe(true);

    // Fire the unlock event for THIS lesson — button should enable.
    act(() => {
      window.dispatchEvent(
        new CustomEvent("policy-doc-acknowledgeable", {
          detail: { lessonId: "l-1", dwellSeconds: 12 },
        }),
      );
    });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("ignores unlock events for a different lesson id", () => {
    render(
      <LessonFooter {...baseProps} requireScrollToComplete />,
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent("policy-doc-acknowledgeable", {
          detail: { lessonId: "different-lesson" },
        }),
      );
    });
    const btn = screen.getByTestId("mark-complete-button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("bypasses the policy gate when initialCompleted is true on mount (re-visit)", () => {
    render(
      <LessonFooter
        {...baseProps}
        requireScrollToComplete
        initialCompleted
      />,
    );
    // Already completed → the "Mark incomplete" affordance is enabled.
    expect(screen.getByTestId("mark-incomplete-button")).toBeInTheDocument();
  });

  it("reverts the optimistic flip when the POST request fails", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    render(<LessonFooter {...baseProps} />);
    fireEvent.click(screen.getByTestId("mark-complete-button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // After the failure the button is still the Mark-complete one.
    expect(screen.getByTestId("mark-complete-button")).toBeInTheDocument();
  });
});
