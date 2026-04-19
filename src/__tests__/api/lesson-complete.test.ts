import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST, DELETE } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route"
);

const makeParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const validLesson = { id: "l1", moduleId: "m1", module: { courseId: "c1" } };
const baseEnrollment = { id: "e1", userId: "user-1", courseId: "c1", enrolledAt: new Date("2026-01-01"), completedAt: null };

describe("POST .../lessons/[lessonId]/complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when lesson does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when lesson belongs to a different module", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "other-module",
      module: { courseId: "c1" },
    });
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when lesson belongs to a different course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      module: { courseId: "other-course" },
    });
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not enrolled in the course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/enrolled/i);
  });

  it("returns 200 with completed:true for enrolled user", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    const completedAt = new Date("2026-04-13T10:00:00Z");
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: completedAt,
      completedAt,
    });
    // Not all lessons completed yet
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }, { id: "l2" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1); // only 1 of 2

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(body.completedAt).toBeTruthy();
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
  });

  it("first completion returns courseComplete:true + stats", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    // enrollment.completedAt is null — first completion
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.enrollment.update.mockResolvedValue({ ...baseEnrollment, completedAt: new Date() });
    const completedAt = new Date();
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1", userId: "user-1", lessonId: "l1", startedAt: completedAt, completedAt,
    });
    // All lessons now complete
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1); // 1 of 1
    // For computeCourseCompletionStats
    mockPrisma.course.findUnique.mockResolvedValue({ title: "Test Course" });
    mockPrisma.courseEmailSubscription.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Alice", email: "alice@example.com" });

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.courseComplete).toBe(true);
    expect(body.courseStats).not.toBeNull();
    expect(body.courseStats.courseTitle).toBe("Test Course");
    expect(body.courseStats.totalLessons).toBe(1);
    expect(body.courseStats.xpEarned).toBe(110); // 1*10 + 100
    expect(body.courseStats.daysTaken).toBeGreaterThanOrEqual(1);
  });

  it("re-completing same lesson after first completion returns courseComplete:false", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    // enrollment.completedAt is already set — already completed
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...baseEnrollment,
      completedAt: new Date("2026-01-15"),
    });
    const completedAt = new Date();
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1", userId: "user-1", lessonId: "l1", startedAt: completedAt, completedAt,
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1); // still "all complete"

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Key invariant: no modal on re-completion
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
    // enrollment.update should NOT have been called
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("uncomplete + re-complete after crossing: courseComplete stays false", async () => {
    // Simulates: user completed all lessons (enrollment.completedAt set),
    // then uncompeted a lesson via DELETE, then re-POSTed it.
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    // enrollment.completedAt is set (sticky, not reset by DELETE)
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...baseEnrollment,
      completedAt: new Date("2026-01-15"),
    });
    const completedAt = new Date();
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1", userId: "user-1", lessonId: "l1", startedAt: completedAt, completedAt,
    });
    // All lessons complete again after re-completing
    mockPrisma.module.findMany.mockResolvedValue([
      { lessons: [{ id: "l1" }, { id: "l2" }] },
    ]);
    mockPrisma.lessonProgress.count.mockResolvedValue(2); // back to 2 of 2

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // The key invariant: no modal fires on re-completion
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("is idempotent — calling POST twice both return 200", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: new Date(),
      completedAt: new Date(),
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }, { id: "l2" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    const makeReq = () =>
      new Request(
        "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
        { method: "POST" },
      );

    const res1 = await POST(makeReq(), makeParams("c1", "m1", "l1"));
    expect(res1.status).toBe(200);
    const res2 = await POST(makeReq(), makeParams("c1", "m1", "l1"));
    expect(res2.status).toBe(200);
  });
});

describe("DELETE .../lessons/[lessonId]/complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when lesson does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not enrolled", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with completed:false for enrolled user", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.updateMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(false);
  });

  it("does not touch enrollment.completedAt on uncomplete", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...baseEnrollment,
      completedAt: new Date("2026-01-15"),
    });
    mockPrisma.lessonProgress.updateMany.mockResolvedValue({ count: 1 });
    await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    // enrollment.update must never be called from DELETE — completedAt stays sticky
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });
});
