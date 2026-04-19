import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { DELETE } = await import("@/app/api/admin/enrollments/[id]/route");

describe("DELETE /api/admin/enrollments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when enrollment not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes enrollment and returns {deleted:true} for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "u1",
      courseId: "c1",
    });
    mockPrisma.enrollment.delete.mockResolvedValue({});

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true });
    expect(mockPrisma.enrollment.delete).toHaveBeenCalledWith({
      where: { id: "e1" },
    });
  });

  it("deletes enrollment for course_manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "u1",
      courseId: "c1",
    });
    mockPrisma.enrollment.delete.mockResolvedValue({});

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(res.status).toBe(200);
  });
});
