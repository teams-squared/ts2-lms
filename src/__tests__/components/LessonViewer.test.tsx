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

  describe("PDF document viewer (fetch + blob URL)", () => {
    const docRef = JSON.stringify({
      driveId: "drive-1",
      itemId: "item-1",
      fileName: "policy.pdf",
      mimeType: "application/pdf",
    });
    const proxyUrl = "/api/sharepoint/files/drive-1/item-1";

    beforeEach(() => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-pdf-url");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

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

    it("shows PDF iframe after fetch resolves", async () => {
      const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      expect(screen.getByText("Loading document…")).toBeInTheDocument();

      await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
      expect(screen.queryByText("Loading document…")).not.toBeInTheDocument();
      expect(document.querySelector("iframe")?.getAttribute("src")).toBe("blob:fake-pdf-url");
    });

    it("shows error fallback when fetch returns an HTTP error", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: false, status: 404 })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      await waitFor(() =>
        expect(screen.getByText("Unable to display document")).toBeInTheDocument()
      );
      // Download link points to the original proxy URL (not a blob URL)
      const link = screen.getByRole("link", { name: /download policy\.pdf/i });
      expect(link).toHaveAttribute("href", proxyUrl);
    });

    it("iframe has sandbox attribute for security", async () => {
      const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) })
      ));

      render(<LessonViewer title="Security Policy" type="document" content={docRef} />);
      await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
      expect(document.querySelector("iframe")?.getAttribute("sandbox")).toContain("allow-same-origin");
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
