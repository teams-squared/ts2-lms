import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkLessonViewer } from "@/components/courses/LinkLessonViewer";

const validContent = JSON.stringify({
  url: "https://example.com/article",
  blurb: "Worth a read.",
});

describe("LinkLessonViewer", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it("renders title, hostname (no www), and blurb", () => {
    render(
      <LinkLessonViewer
        lessonId="l1"
        title="Security Best Practices"
        content={JSON.stringify({
          url: "https://www.example.com/article",
          blurb: "Worth a read.",
        })}
      />,
    );
    // Title renders twice: once in the LessonTitleHeader h1, once in the
    // article card. Both intentional.
    expect(
      screen.getByRole("heading", { name: "Security Best Practices" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Security Best Practices").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Worth a read.")).toBeInTheDocument();
  });

  it("renders the Open article link with safe rel attributes and the article URL", () => {
    render(
      <LinkLessonViewer lessonId="l1" title="Article" content={validContent} />,
    );
    const link = screen.getByRole("link", { name: /open article/i });
    expect(link).toHaveAttribute("href", "https://example.com/article");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("rel")).toContain("nofollow");
  });

  it("dispatches the unlock event when Open article is clicked", () => {
    render(
      <LinkLessonViewer lessonId="l1" title="Article" content={validContent} />,
    );
    fireEvent.click(screen.getByRole("link", { name: /open article/i }));
    const dispatched = dispatchSpy.mock.calls
      .map(([ev]) => ev as Event)
      .filter((ev) => ev.type === "policy-doc-acknowledgeable");
    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as CustomEvent).detail).toEqual({ lessonId: "l1" });
  });

  it("pre-fires the unlock event on mount when alreadyCompleted", () => {
    render(
      <LinkLessonViewer
        lessonId="l1"
        title="Article"
        content={validContent}
        alreadyCompleted
      />,
    );
    const dispatched = dispatchSpy.mock.calls
      .map(([ev]) => ev as Event)
      .filter((ev) => ev.type === "policy-doc-acknowledgeable");
    expect(dispatched).toHaveLength(1);
  });

  it("hides the unlock-hint copy on re-visit (alreadyCompleted)", () => {
    render(
      <LinkLessonViewer
        lessonId="l1"
        title="Article"
        content={validContent}
        alreadyCompleted
      />,
    );
    expect(
      screen.queryByText(/opening the article unlocks/i),
    ).not.toBeInTheDocument();
  });

  it("renders fallback message for invalid content", () => {
    render(
      <LinkLessonViewer
        lessonId="l1"
        title="Broken"
        content="not-valid-json"
      />,
    );
    expect(
      screen.getByText(/no article url configured/i),
    ).toBeInTheDocument();
  });

  it("renders fallback for javascript: URL (rejected by parser)", () => {
    render(
      <LinkLessonViewer
        lessonId="l1"
        title="Bad"
        content='{"url":"javascript:alert(1)"}'
      />,
    );
    expect(
      screen.getByText(/no article url configured/i),
    ).toBeInTheDocument();
  });
});
