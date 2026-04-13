import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuth, mockSession } from "@/__tests__/mocks/auth";

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", async () => {
  const { mockPrisma } = await import("@/__tests__/mocks/prisma");
  return { default: mockPrisma, prisma: mockPrisma };
});

const mockGetSiteId = vi.fn();
const mockListDriveItems = vi.fn();
const mockGetCachedMetadata = vi.fn();
const mockSetCachedMetadata = vi.fn();

vi.mock("@/lib/sharepoint/config", () => ({
  assertConfigured: vi.fn(),
  getSharePointConfig: () => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    siteUrl: "example.sharepoint.com/sites/test",
    rootFolder: "LMS Materials",
  }),
}));

vi.mock("@/lib/sharepoint/graph-client", () => ({
  getSiteId: mockGetSiteId,
  listDriveItems: mockListDriveItems,
}));

vi.mock("@/lib/sharepoint/cache", () => ({
  getCachedMetadata: mockGetCachedMetadata,
  setCachedMetadata: mockSetCachedMetadata,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function importGET() {
  const mod = await import("@/app/api/sharepoint/browse/route");
  return mod.GET;
}

describe("GET /api/sharepoint/browse", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const GET = await importGET();
    const res = await GET(new Request("http://localhost/api/sharepoint/browse"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "employee" }));
    const GET = await importGET();
    const res = await GET(new Request("http://localhost/api/sharepoint/browse"));
    expect(res.status).toBe(403);
  });

  it("returns cached response when available", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "admin" }));
    mockGetCachedMetadata.mockResolvedValueOnce({
      data: { items: [{ type: "file", id: "f1", name: "test.pdf" }], breadcrumbs: [] },
      etag: null,
    });

    const GET = await importGET();
    const res = await GET(new Request("http://localhost/api/sharepoint/browse"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("test.pdf");
    expect(mockGetSiteId).not.toHaveBeenCalled();
  });

  it("fetches from Graph API on cache miss", async () => {
    mockAuth.mockResolvedValueOnce(mockSession({ role: "manager" }));
    mockGetCachedMetadata.mockResolvedValueOnce(null);
    mockGetSiteId.mockResolvedValueOnce("site-1");
    // First call: root listing to find LMS Materials folder
    mockListDriveItems.mockResolvedValueOnce({
      value: [{ id: "folder-1", name: "LMS Materials", folder: { childCount: 3 }, parentReference: { driveId: "drive-1" } }],
    });
    // Second call: contents of LMS Materials
    mockListDriveItems.mockResolvedValueOnce({
      value: [
        { id: "f1", name: "doc.pdf", file: { mimeType: "application/pdf" }, size: 1024, webUrl: "https://sp/doc.pdf", lastModifiedDateTime: "2026-01-01", parentReference: { driveId: "drive-1" } },
      ],
    });
    mockSetCachedMetadata.mockResolvedValueOnce(undefined);

    const GET = await importGET();
    const res = await GET(new Request("http://localhost/api/sharepoint/browse"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("doc.pdf");
    expect(mockSetCachedMetadata).toHaveBeenCalledOnce();
  });
});
