import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { DELETE } = await import(
  "@/app/api/admin/users/[userId]/clearances/[clearance]/route"
);

describe("DELETE /api/admin/users/[userId]/clearances/[clearance]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "mgr-id", role: "manager" }),
    );
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1", clearance: "secret" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1", clearance: "secret" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when clearance not found", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.userClearance.findUnique.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1", clearance: "secret" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes clearance and returns {deleted:true}", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.userClearance.findUnique.mockResolvedValue({
      id: "uc1",
      userId: "u1",
      clearance: "secret",
      grantedAt: new Date(),
    });
    mockPrisma.userClearance.delete.mockResolvedValue({});

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1", clearance: "secret" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ deleted: true });
    expect(mockPrisma.userClearance.delete).toHaveBeenCalledWith({
      where: {
        userId_clearance: { userId: "u1", clearance: "secret" },
      },
    });
  });
});
