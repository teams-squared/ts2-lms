import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuth, mockSession } from "@/__tests__/mocks/auth";

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockGetDriveItemContent = vi.fn();
const mockGetDriveItemMetadata = vi.fn();
const mockGetCachedFile = vi.fn();
const mockSetCachedFile = vi.fn();

vi.mock("@/lib/sharepoint/graph-client", () => ({
  getDriveItemContent: mockGetDriveItemContent,
  getDriveItemMetadata: mockGetDriveItemMetadata,
}));

vi.mock("@/lib/sharepoint/cache", () => ({
  getCachedFile: mockGetCachedFile,
  setCachedFile: mockSetCachedFile,
}));

const params = (driveId: string, itemId: string) => ({
  params: Promise.resolve({ driveId, itemId }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function importGET() {
  const mod = await import("@/app/api/sharepoint/files/[driveId]/[itemId]/route");
  return mod.GET;
}

describe("GET /api/sharepoint/files/[driveId]/[itemId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/i1"),
      params("d1", "i1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "employee" }));
    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/i1"),
      params("d1", "i1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for instructor role", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "instructor" }));
    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/i1"),
      params("d1", "i1")
    );
    expect(res.status).toBe(403);
  });

  it("streams file with correct headers from cache", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "manager" }));
    mockGetCachedFile.mockResolvedValueOnce({
      data: Buffer.from("pdf-content"),
      meta: { mimeType: "application/pdf", fileName: "test.pdf", etag: "e1", expiresAt: Date.now() + 60000 },
    });

    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/i1"),
      params("d1", "i1")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Content-Disposition")).toContain("test.pdf");
  });

  it("returns 404 when file not found in Graph", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "admin" }));
    mockGetCachedFile.mockResolvedValueOnce(null);
    mockGetDriveItemMetadata.mockRejectedValueOnce(new Error("Not found (404)"));

    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/missing"),
      params("d1", "missing")
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("File not found");
  });

  it("fetches from Graph on cache miss and caches result", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "manager" }));
    mockGetCachedFile.mockResolvedValueOnce(null);
    mockGetDriveItemMetadata.mockResolvedValueOnce({
      id: "i1",
      name: "report.docx",
      file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      eTag: "etag-1",
    });
    mockGetDriveItemContent.mockResolvedValueOnce(
      new Response("docx-bytes", { status: 200 })
    );
    mockSetCachedFile.mockResolvedValueOnce(undefined);

    const GET = await importGET();
    const res = await GET(
      new Request("http://localhost/api/sharepoint/files/d1/i1"),
      params("d1", "i1")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("report.docx");
  });
});
