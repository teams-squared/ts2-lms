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

  it("renders PDF iframe for document lesson with PDF mimeType", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
    expect(screen.getByText("Security Policy")).toBeInTheDocument();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("/api/sharepoint/files/drive-1/item-1");
  });

  it("renders download card for document lesson with non-PDF mimeType", () => {
    const docRef = JSON.stringify({
      driveId: "drive-2",
      itemId: "item-2",
      fileName: "report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    render(<LessonViewer title="Quarterly Report" type="document" content={docRef} />);
    expect(screen.getByText("Quarterly Report")).toBeInTheDocument();
    expect(screen.getByText("report.docx")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toHaveAttribute("href", "/api/sharepoint/files/drive-2/item-2");
    expect(link).toHaveAttribute("download", "report.docx");
  });

  it("renders empty state for document lesson with null content", () => {
    render(<LessonViewer title="Pending Doc" type="document" content={null} />);
    expect(screen.getByText("Pending Doc")).toBeInTheDocument();
    expect(screen.getByText("No document attached.")).toBeInTheDocument();
  });
});
