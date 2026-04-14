import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  describe("PDF document viewer (pre-flight fetch + cached proxy URL)", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    const proxyUrl = "/api/sharepoint/files/drive-1/item-1";

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("renders PDF loading spinner initially for document lesson with PDF mimeType", () => {
      // fetch never resolves → component stays in loading state
      vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      expect(screen.getByText("Security Policy")).toBeInTheDocument();
      expect(screen.getByText("Loading document…")).toBeInTheDocument();
      // No iframe until fetch resolves
      expect(document.querySelector("iframe")).toBeNull();
    });

    it("shows PDF iframe with proxy URL after pre-flight fetch succeeds", async () => {
      const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      expect(screen.getByText("Loading document…")).toBeInTheDocument();

      await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
      expect(screen.queryByText("Loading document…")).not.toBeInTheDocument();
      // iframe loads from browser cache via the original proxy URL (no blob: URL)
      expect(document.querySelector("iframe")?.getAttribute("src")).toBe(proxyUrl);
    });

    it("shows error fallback when fetch returns an HTTP error", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: false, status: 404 })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      await waitFor(() =>
        expect(screen.getByText("Unable to display document")).toBeInTheDocument()
      );
      const link = screen.getByRole("link", { name: /download policy\.pdf/i });
      expect(link).toHaveAttribute("href", proxyUrl);
    });

    it("iframe renders with the proxy URL (no sandbox — Chrome PDF viewer requires it)", async () => {
      const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
      // No sandbox — Chrome's built-in PDF viewer fails inside sandboxed iframes
      expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBeNull();
    });
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
