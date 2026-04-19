import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockGetDriveItemContent = vi.fn();
vi.mock("@/lib/sharepoint/graph-client", () => ({
  getDriveItemContent: mockGetDriveItemContent,
}));

const { GET } = await import("@/app/api/lessons/[lessonId]/video/route");

const params = (lessonId: string) => ({
  params: Promise.resolve({ lessonId }),
});

const sharepointRef = JSON.stringify({
  driveId: "d1",
  itemId: "i1",
  fileName: "training.mp4",
  mimeType: "video/mp4",
});

function makeUpstream(status = 200, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array([1, 2, 3]), { status, headers });
}

describe("GET /api/lessons/[lessonId]/video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when lesson is missing or not VIDEO type", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    let res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(404);

    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "TEXT",
      content: "hi",
      module: { courseId: "c1" },
    });
    res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when content is not a SharePoint ref", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: "https://youtube.com/embed/xyz",
      module: { courseId: "c1" },
    });
    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(404);
  });

  it("returns 415 when ref's mimeType is not video/*", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: JSON.stringify({ driveId: "d1", itemId: "i1", fileName: "doc.pdf", mimeType: "application/pdf" }),
      module: { courseId: "c1" },
    });
    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(415);
  });

  it("returns 403 for non-enrolled employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee", id: "u1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: sharepointRef,
      module: { courseId: "c1" },
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(403);
  });

  it("streams video for admin with correct headers", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: sharepointRef,
      module: { courseId: "c1" },
    });
    mockGetDriveItemContent.mockResolvedValue(makeUpstream(200, { "content-length": "3" }));

    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Disposition")).toBeNull();
  });

  it("passes Range header through and returns 206", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: sharepointRef,
      module: { courseId: "c1" },
    });
    mockGetDriveItemContent.mockResolvedValue(
      makeUpstream(206, { "content-range": "bytes 0-1023/5000", "content-length": "1024" })
    );

    const res = await GET(
      new Request("http://localhost/api/lessons/l1/video", {
        headers: { Range: "bytes=0-1023" },
      }),
      params("l1")
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1023/5000");
    expect(mockGetDriveItemContent).toHaveBeenCalledWith("d1", "i1", { range: "bytes=0-1023" });
  });

  it("streams video for enrolled employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee", id: "u1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: sharepointRef,
      module: { courseId: "c1" },
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue({ userId: "u1", courseId: "c1" });
    mockGetDriveItemContent.mockResolvedValue(makeUpstream(200));

    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.enrollment.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "u1", courseId: "c1" } },
    });
  });

  it("returns 502 when Graph call fails", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      type: "VIDEO",
      content: sharepointRef,
      module: { courseId: "c1" },
    });
    mockGetDriveItemContent.mockRejectedValue(new Error("Graph down"));
    const res = await GET(new Request("http://localhost/api/lessons/l1/video"), params("l1"));
    expect(res.status).toBe(502);
  });
});
