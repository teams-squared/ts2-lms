import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/xp", () => ({
  awardXp: vi.fn().mockResolvedValue({ newAchievements: [] }),
}));
vi.mock("@/lib/posthog-server", () => ({
  trackEvent: vi.fn(),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { POST } = await import("@/app/api/admin/enrollments/batch/route");

const makeReq = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/admin/enrollments/batch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

/** Helper: build a mock tx that mirrors mockPrisma shape */
function makeMockTx() {
  return {
    enrollment: {
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("POST /api/admin/enrollments/batch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin/non-manager", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await POST(makeReq({ userId: "u1", courseIds: ["c1"] }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ courseIds: ["c1"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/userId/);
  });

  it("returns 400 when courseIds is missing", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ userId: "u1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when courseIds is an empty array", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ userId: "u1", courseIds: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ userId: "u1", courseIds: ["c1"] }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("User not found");
  });

  it("creates enrollments for valid request", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "User One" });
    mockPrisma.course.findMany.mockResolvedValue([
      { id: "c1", title: "Course One" },
      { id: "c2", title: "Course Two" },
    ]);
    mockPrisma.enrollment.findMany.mockResolvedValue([]);

    const now = new Date();
    const mockTx = makeMockTx();
    mockTx.enrollment.create
      .mockResolvedValueOnce({
        id: "e1",
        userId: "u1",
        courseId: "c1",
        enrolledAt: now,
        user: { id: "u1", name: "User One", email: "u1@test.com" },
        course: { id: "c1", title: "Course One" },
      })
      .mockResolvedValueOnce({
        id: "e2",
        userId: "u1",
        courseId: "c2",
        enrolledAt: now,
        user: { id: "u1", name: "User One", email: "u1@test.com" },
        course: { id: "c2", title: "Course Two" },
      });

    mockPrisma.$transaction.mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await POST(makeReq({ userId: "u1", courseIds: ["c1", "c2"] }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.created).toHaveLength(2);
    expect(body.created[0].id).toBe("e1");
    expect(body.created[1].id).toBe("e2");
    expect(body.skipped).toHaveLength(0);
    expect(body.xpAwarded).toBe(10);
  });

  it("skips already-enrolled courses", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "User One" });
    mockPrisma.course.findMany.mockResolvedValue([
      { id: "c1", title: "Course One" },
      { id: "c2", title: "Course Two" },
    ]);
    // c1 is already enrolled
    mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: "c1" }]);

    const now = new Date();
    const mockTx = makeMockTx();
    mockTx.enrollment.create.mockResolvedValueOnce({
      id: "e2",
      userId: "u1",
      courseId: "c2",
      enrolledAt: now,
      user: { id: "u1", name: "User One", email: "u1@test.com" },
      course: { id: "c2", title: "Course Two" },
    });

    mockPrisma.$transaction.mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await POST(makeReq({ userId: "u1", courseIds: ["c1", "c2"] }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.created).toHaveLength(1);
    expect(body.created[0].id).toBe("e2");
    expect(body.skipped).toEqual(["c1"]);
    expect(body.xpAwarded).toBe(5);
  });

  it("returns correct counts when all courses already enrolled", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "User One" });
    mockPrisma.course.findMany.mockResolvedValue([
      { id: "c1", title: "Course One" },
      { id: "c2", title: "Course Two" },
    ]);
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { courseId: "c1" },
      { courseId: "c2" },
    ]);

    const res = await POST(makeReq({ userId: "u1", courseIds: ["c1", "c2"] }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.created).toEqual([]);
    expect(body.skipped).toEqual(["c1", "c2"]);
  });
});
