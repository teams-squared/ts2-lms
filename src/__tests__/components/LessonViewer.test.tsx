import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LessonViewer } from "@/components/courses/LessonViewer";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

describe("LessonViewer", () => {
  it("renders markdown content for text lessons", () => {
    render(
      <LessonViewer title="My Lesson" type="text" content="# Hello World" />
    );
    expect(screen.getByText("My Lesson")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("# Hello World");
  });

  it("renders empty state for text lesson without content", () => {
    render(<LessonViewer title="Empty Lesson" type="text" content={null} />);
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
  });

  it("renders iframe for video lessons", () => {
    render(
      <LessonViewer
        title="Video Lesson"
        type="video"
        content="https://youtube.com/embed/abc"
      />
    );
    expect(screen.getByText("Video Lesson")).toBeInTheDocument();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("https://youtube.com/embed/abc");
  });

  it("renders empty state for video lesson without URL", () => {
    render(<LessonViewer title="No Video" type="video" content={null} />);
    expect(screen.getByText("No video URL provided.")).toBeInTheDocument();
  });

  it("renders placeholder for quiz lessons", () => {
    render(<LessonViewer title="Quiz Time" type="quiz" content={null} />);
    expect(screen.getByText("Quiz Time")).toBeInTheDocument();
    expect(
      screen.getByText("Quiz functionality coming soon.")
    ).toBeInTheDocument();
  });
});
