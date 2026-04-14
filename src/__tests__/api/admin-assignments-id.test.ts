import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { DELETE } = await import(
  "@/app/api/admin/assignments/[id]/route"
);

describe("DELETE /api/admin/assignments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "emp-id", role: "employee" }));
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when assignment not found", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.assignment.findUnique.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes assignment and returns {deleted:true} for admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.assignment.findUnique.mockResolvedValue({
      id: "a1",
      courseId: "c1",
      userId: "u1",
      assignedById: "admin-id",
    });
    mockPrisma.assignment.delete.mockResolvedValue({});

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ deleted: true });
    expect(mockPrisma.assignment.delete).toHaveBeenCalledWith({
      where: { id: "a1" },
    });
  });
});
