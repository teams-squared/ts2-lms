import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import("@/app/api/admin/iso-library/entries/route");

describe("POST /api/admin/iso-library/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ policyDocLessonIds: ["pdl-1"] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "mgr-id", role: "course_manager" }),
    );
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ policyDocLessonIds: ["pdl-1"] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when policyDocLessonIds missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates entries and skips duplicates silently", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.isoLibraryEntry.findFirst.mockResolvedValue({ sortOrder: 4 });

    // First create succeeds; second hits a unique violation; third succeeds.
    const duplicateErr = Object.assign(new Error("Unique"), { code: "P2002" });
    mockPrisma.isoLibraryEntry.create
      .mockResolvedValueOnce({ id: "e-a" })
      .mockRejectedValueOnce(duplicateErr)
      .mockResolvedValueOnce({ id: "e-c" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        policyDocLessonIds: ["pdl-a", "pdl-b", "pdl-c"],
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.createdIds).toEqual(["e-a", "e-c"]);

    // Sort orders should be contiguous (5, 6) — the duplicate at index 1 is
    // skipped without burning an order slot, so the third row gets 6, not 7.
    const calls = mockPrisma.isoLibraryEntry.create.mock.calls;
    expect(calls[0][0].data.sortOrder).toBe(5);
    expect(calls[1][0].data.sortOrder).toBe(6);
    expect(calls[2][0].data.sortOrder).toBe(6);
  });
});
