import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PolicyDocLessonEditor } from "@/components/courses/PolicyDocLessonEditor";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

const snapshot = {
  id: "pdl-1",
  sharePointDriveId: "drive-1",
  sharePointItemId: "item-1",
  sharePointWebUrl: "https://sp.example.com/doc",
  documentTitle: "Privacy Policy",
  documentCode: "POL-001",
  sourceVersion: "1.2",
  sourceETag: "etag-1",
  sourceLastModified: new Date().toISOString(),
  approver: "Akil",
  approvedOn: null,
  lastReviewedOn: null,
  renderMode: "PARSED" as const,
  renderedHTMLHash: "hash-1",
  lastSyncedAt: new Date().toISOString(),
  lastSyncedBy: { name: "Akil", email: "akil@x" },
};

describe("PolicyDocLessonEditor", () => {
  it("shows the unbound state when the GET returns bound=false", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bound: false }),
    } as Response);
    render(<PolicyDocLessonEditor lessonId="l-1" />);
    expect(
      await screen.findByPlaceholderText(/sharepoint\.com/i),
    ).toBeInTheDocument();
  });

  it("shows the bound state when the GET returns a policyDoc snapshot", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bound: true, policyDoc: snapshot }),
    } as Response);
    render(<PolicyDocLessonEditor lessonId="l-1" />);
    expect(await screen.findByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Open in SharePoint ↗")).toBeInTheDocument();
    expect(screen.getByText("Re-sync")).toBeInTheDocument();
    expect(screen.getByText("Replace document…")).toBeInTheDocument();
  });

  it("surfaces an error when the initial fetch fails", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);
    render(<PolicyDocLessonEditor lessonId="l-1" />);
    expect(
      await screen.findByText(/Failed to load \(500\)/),
    ).toBeInTheDocument();
  });

  it("disables Use link when the share URL is empty", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bound: false }),
    } as Response);
    render(<PolicyDocLessonEditor lessonId="l-1" />);
    const useLinkBtn = await screen.findByText("Use link");
    expect(useLinkBtn.closest("button")?.hasAttribute("disabled")).toBe(true);
  });

  it("posts to resolve-share when Use link is clicked with a URL", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bound: false }),
    } as Response);
    render(<PolicyDocLessonEditor lessonId="l-1" />);
    const input = await screen.findByPlaceholderText(/sharepoint\.com/i);
    fireEvent.change(input, {
      target: { value: "https://example.sharepoint.com/file.docx" },
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ driveId: "d-1", itemId: "i-1" }),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "synced" }),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bound: true, policyDoc: snapshot }),
    } as Response);
    fireEvent.click(screen.getByText("Use link"));
    expect(
      fetchSpy.mock.calls.some(
        (c) => c[0] === "/api/admin/policy-doc/resolve-share",
      ),
    ).toBe(true);
  });
});
