import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import(
  "@/app/api/iso-library/[entryId]/view/route"
);

describe("POST /api/iso-library/[entryId]/view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ entryId: "e-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u-1", role: "employee" }));
    mockPrisma.isoLibraryEntry.findUnique.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ entryId: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.isoLibraryView.create).not.toHaveBeenCalled();
  });

  it("logs view with current sourceVersion for an authed user", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u-1", role: "employee" }));
    mockPrisma.isoLibraryEntry.findUnique.mockResolvedValue({
      id: "e-1",
      policyDocLesson: { sourceVersion: "2.4" },
    });

    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ entryId: "e-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.isoLibraryView.create).toHaveBeenCalledWith({
      data: { entryId: "e-1", userId: "u-1", sourceVersion: "2.4" },
    });
  });
});
