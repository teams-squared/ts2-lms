import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const mockGetNodeTree = vi.fn();
vi.mock("@/lib/courseNodes", () => ({
  getNodeTree: (...args: unknown[]) => mockGetNodeTree(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET, POST } = await import("@/app/api/admin/nodes/route");

describe("GET /api/admin/nodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns node tree for admin", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const mockTree = [
      { id: "n1", name: "Law", children: [], courses: [] },
    ];
    mockGetNodeTree.mockResolvedValue(mockTree);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockTree);
  });
});

describe("POST /api/admin/nodes", () => {
  beforeEach(() => vi.clearAllMocks());

  const makeReq = (body: Record<string, unknown>) =>
    new Request("http://localhost/api/admin/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await POST(makeReq({ name: "Test" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing name", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it("returns 400 for empty name", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ name: "   " }));
    expect(res.status).toBe(400);
  });

  it("creates root node (no parentId)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.courseNode.aggregate.mockResolvedValue({ _max: { order: null } });
    mockPrisma.courseNode.create.mockResolvedValue({
      id: "n1",
      name: "Law Courses",
      description: null,
      parentId: null,
      order: 0,
    });

    const res = await POST(makeReq({ name: "Law Courses" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Law Courses");
    expect(mockPrisma.courseNode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Law Courses",
          parentId: null,
          order: 0,
        }),
      }),
    );
  });

  it("creates child node with valid parentId", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.courseNode.findUnique.mockResolvedValue({ id: "parent-1", name: "Law" });
    mockPrisma.courseNode.aggregate.mockResolvedValue({ _max: { order: 2 } });
    mockPrisma.courseNode.create.mockResolvedValue({
      id: "n2",
      name: "Property Law",
      description: null,
      parentId: "parent-1",
      order: 3,
    });

    const res = await POST(makeReq({ name: "Property Law", parentId: "parent-1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.parentId).toBe("parent-1");
    expect(body.order).toBe(3);
  });

  it("returns 404 for nonexistent parent", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.courseNode.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ name: "Child", parentId: "bad-id" }));
    expect(res.status).toBe(404);
  });
});
