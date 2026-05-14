import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePointFilePicker } from "@/components/courses/SharePointFilePicker";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

describe("SharePointFilePicker — modal contents", () => {
  it("renders the modal heading + Close affordance when open", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], breadcrumbs: [] }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("Browse SharePoint")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("calls onClose when the close affordance is clicked", async () => {
    const onClose = vi.fn();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], breadcrumbs: [] }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders folder and file rows from the browse response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "f-1",
            driveId: "d-1",
            type: "folder",
            name: "Policies",
            childCount: 3,
            mimeType: "",
          },
          {
            id: "f-2",
            driveId: "d-1",
            type: "file",
            name: "intro.pdf",
            childCount: 0,
            mimeType: "application/pdf",
            size: 1024,
          },
        ],
        breadcrumbs: [],
      }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("Policies")).toBeInTheDocument();
    expect(screen.getByText("intro.pdf")).toBeInTheDocument();
  });

  it("calls onSelect + onClose when a file row is clicked", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "f-2",
            driveId: "d-1",
            type: "file",
            name: "intro.pdf",
            childCount: 0,
            mimeType: "application/pdf",
            size: 1024,
          },
        ],
        breadcrumbs: [],
      }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(await screen.findByText("intro.pdf"));
    expect(onSelect).toHaveBeenCalledWith({
      driveId: "d-1",
      itemId: "f-2",
      fileName: "intro.pdf",
      mimeType: "application/pdf",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the empty-folder copy when items[] is empty", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], breadcrumbs: [] }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("This folder is empty."),
    ).toBeInTheDocument();
  });

  it("filters files by mimeType when mimeTypeFilter is supplied", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "f-1",
            driveId: "d-1",
            type: "file",
            name: "video.mp4",
            childCount: 0,
            mimeType: "video/mp4",
            size: 1024,
          },
          {
            id: "f-2",
            driveId: "d-1",
            type: "file",
            name: "doc.pdf",
            childCount: 0,
            mimeType: "application/pdf",
            size: 1024,
          },
        ],
        breadcrumbs: [],
      }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        mimeTypeFilter={(mt) => mt === "application/pdf"}
        filterLabel="PDFs"
      />,
    );
    // Only the PDF should be visible after filter.
    expect(await screen.findByText("doc.pdf")).toBeInTheDocument();
    expect(screen.queryByText("video.mp4")).toBeNull();
    expect(screen.getByText(/Showing: PDFs only/)).toBeInTheDocument();
  });

  it("surfaces a server error", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    } as Response);
    render(
      <SharePointFilePicker
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });
});
