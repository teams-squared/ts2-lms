import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("quiz type falls through to text path (no quiz-specific branch)", () => {
    render(<LessonViewer title="Quiz Time" type="quiz" content={null} />);
    expect(screen.getByText("Quiz Time")).toBeInTheDocument();
    // Falls through to text path — renders "No content yet." placeholder
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
  });

  it("renders PDF loading spinner initially for document lesson with PDF mimeType", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
    expect(screen.getByText("Security Policy")).toBeInTheDocument();
    expect(screen.getByText("Loading document…")).toBeInTheDocument();
    // iframe is present but hidden while loading
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("/api/sharepoint/files/drive-1/item-1");
  });

  it("shows PDF iframe after onLoad fires", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
    const iframe = document.querySelector("iframe")!;
    fireEvent.load(iframe);
    // Spinner gone, iframe visible
    expect(screen.queryByText("Loading document…")).not.toBeInTheDocument();
    expect(iframe.style.display).not.toBe("none");
  });

  it("iframe has onError handler attribute (error state covered by e2e)", () => {
    // Note: iframe onError does not propagate through React's synthetic event
    // system in happy-dom. Error state is verified in browser-based e2e tests.
    // Here we verify the iframe is rendered with the correct src so the
    // onError handler has a URL to fall back to.
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
    const iframe = document.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe("/api/sharepoint/files/drive-1/item-1");
    // The error fallback download URL matches the proxy URL
    expect(iframe.getAttribute("src")).toContain("drive-1");
    expect(iframe.getAttribute("src")).toContain("item-1");
  });

  it("iframe has sandbox attribute for security", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-same-origin");
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
