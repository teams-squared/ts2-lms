import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockTrackEvent = vi.fn();
vi.mock("@/lib/posthog-server", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { POST } = await import(
  "@/app/api/admin/users/[userId]/enrollments/[courseId]/reset/route"
);

const makeReq = () =>
  new Request("http://localhost/api/admin/users/u1/enrollments/c1/reset", {
    method: "POST",
  });

const callPost = (userId: string, courseId: string) =>
  POST(makeReq(), { params: Promise.resolve({ userId, courseId }) });

function makeMockTx() {
  return {
    lessonProgress: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    quizAttempt: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    enrollment: { update: vi.fn().mockResolvedValue({}) },
  };
}

describe("POST /api/admin/users/[userId]/enrollments/[courseId]/reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when requireRole rejects (non-admin)", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await callPost("u1", "c1");
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
  });

  it("returns 404 when enrollment is missing", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await callPost("u1", "c1");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/enrollment not found/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("wipes progress + clears completedAt — happy path on a completed enrollment", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      completedAt: new Date("2026-02-01"),
      course: { title: "Onboarding 101" },
    });
    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: "l1" },
      { id: "l2" },
      { id: "l3" },
    ]);

    const tx = makeMockTx();
    tx.lessonProgress.deleteMany.mockResolvedValue({ count: 3 });
    tx.quizAttempt.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const res = await callPost("u1", "c1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      reset: true,
      progressDeleted: 3,
      attemptsDeleted: 2,
      wasCompleted: true,
    });

    // All scoped to the right user × course's lessons
    expect(tx.lessonProgress.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", lessonId: { in: ["l1", "l2", "l3"] } },
    });
    expect(tx.quizAttempt.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", lessonId: { in: ["l1", "l2", "l3"] } },
    });
    // Sticky completedAt cleared
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { completedAt: null },
    });

    // Audit
    expect(mockTrackEvent).toHaveBeenCalledWith("admin-1", "enrollment_progress_reset", {
      targetUserId: "u1",
      courseId: "c1",
      courseTitle: "Onboarding 101",
      wasCompleted: true,
      progressDeleted: 3,
      attemptsDeleted: 2,
    });
  });

  it("works on an in-progress (non-completed) enrollment", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e2",
      completedAt: null,
      course: { title: "Compliance" },
    });
    mockPrisma.lesson.findMany.mockResolvedValue([{ id: "lA" }]);

    const tx = makeMockTx();
    tx.lessonProgress.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const res = await callPost("u1", "c1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wasCompleted).toBe(false);
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: "e2" },
      data: { completedAt: null },
    });
  });

  it("skips delete calls when course has no lessons (still clears completedAt)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e3",
      completedAt: new Date(),
      course: { title: "Empty Course" },
    });
    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const tx = makeMockTx();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const res = await callPost("u1", "c1");
    expect(res.status).toBe(200);
    expect(tx.lessonProgress.deleteMany).not.toHaveBeenCalled();
    expect(tx.quizAttempt.deleteMany).not.toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalled();
  });
});
