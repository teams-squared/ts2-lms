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
    mockPrisma.lessonProgress.create.mockResolvedValue({
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
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    const completedAt = new Date();
    mockPrisma.lessonProgress.create.mockResolvedValue({
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
    mockPrisma.lessonProgress.create.mockResolvedValue({
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
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
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
    mockPrisma.lessonProgress.create.mockResolvedValue({
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
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("POST is a no-op when course is locked at completed", async () => {
    // Locked enrollments are read-only — POST returns the existing progress
    // state without writing anything, awarding XP, or firing events.
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...baseEnrollment,
      completedAt: new Date("2026-02-01"),
    });
    const existingCompletedAt = new Date("2026-02-01T10:00:00Z");
    mockPrisma.lessonProgress.findUnique.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: existingCompletedAt,
      completedAt: existingCompletedAt,
    });

    const res = await POST(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "POST" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locked).toBe(true);
    expect(body.completed).toBe(true);
    expect(body.xpAwarded).toBe(0);
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
    // No writes
    expect(mockPrisma.lessonProgress.create).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("is idempotent — calling POST twice both return 200", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.create.mockResolvedValue({
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

  // ── POLICY_DOC audit snapshot ─────────────────────────────────────────────

  it("POLICY_DOC: stamps audit fields from PolicyDocLesson onto LessonProgress", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      type: "POLICY_DOC",
      module: { courseId: "c1" },
      policyDoc: {
        sourceVersion: "1.1.0",
        sourceETag: "etag-xyz",
        renderedHTMLHash: "hash-deadbeef",
      },
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.create.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: new Date(),
      completedAt: new Date(),
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }, { id: "l2" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);

    // The transition path uses a single `create` call; audit fields ride
    // on data. (The fallback updateMany path also stamps these via its
    // `data` arg, exercised by the "already-complete" test below.)
    const createArgs = mockPrisma.lessonProgress.create.mock.calls[0][0];
    expect(createArgs.data.acknowledgedVersion).toBe("1.1.0");
    expect(createArgs.data.acknowledgedETag).toBe("etag-xyz");
    expect(createArgs.data.acknowledgedHash).toBe("hash-deadbeef");
    expect(createArgs.data.acknowledgedAt).toBeInstanceOf(Date);
  });

  it("POLICY_DOC: returns 409 when the lesson has no PolicyDocLesson row yet", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      type: "POLICY_DOC",
      module: { courseId: "c1" },
      policyDoc: null, // not yet synced
    });
    // enrollment lookup never reached — guard fires first

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not yet synced/i);
    expect(mockPrisma.lessonProgress.create).not.toHaveBeenCalled();
  });

  it("non-POLICY_DOC lesson does not write audit fields", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      type: "TEXT",
      module: { courseId: "c1" },
      policyDoc: null,
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.create.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: new Date(),
      completedAt: new Date(),
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(0);

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    await POST(req, makeParams("c1", "m1", "l1"));

    const createArgs = mockPrisma.lessonProgress.create.mock.calls[0][0];
    expect(createArgs.data.acknowledgedVersion).toBeUndefined();
  });

  // ── Race-detection / idempotency on rapid double-click ─────────────────────
  // The route must do XP, analytics, ISO ack email, and course-completion
  // emails ONLY on the genuine incomplete→complete transition. A duplicate
  // request (same user clicking twice, or a network retry) must be a no-op
  // for side effects.

  it("re-clicking an already-complete lesson does NOT double-award XP", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    // Create throws unique-violation: row already exists.
    mockPrisma.lessonProgress.create.mockRejectedValue({ code: "P2002" });
    // Conditional updateMany sees completedAt already set → 0 rows affected.
    mockPrisma.lessonProgress.updateMany.mockResolvedValue({ count: 0 });
    // findUnique returns the existing complete row.
    const existingCompletedAt = new Date("2026-02-01T10:00:00Z");
    mockPrisma.lessonProgress.findUnique.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: existingCompletedAt,
      completedAt: existingCompletedAt,
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    const res = await POST(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "POST" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(true);
    // Key invariant: re-click awards 0 XP.
    expect(body.xpAwarded).toBe(0);
    // Key invariant: course-completion side effects skipped on re-click.
    expect(body.courseComplete).toBe(false);
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("first transition awards XP and fires course-completion side effects", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    // Create succeeds — first time this row exists.
    const completedAt = new Date();
    mockPrisma.lessonProgress.create.mockResolvedValue({
      id: "lp1", userId: "user-1", lessonId: "l1", startedAt: completedAt, completedAt,
    });
    // All lessons complete after this one.
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    // enrollment.updateMany wins the race (count=1).
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.course.findUnique.mockResolvedValue({ title: "Test Course" });
    mockPrisma.courseEmailSubscription.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Alice", email: "alice@example.com" });

    const res = await POST(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "POST" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.xpAwarded).toBe(10);
    expect(body.courseComplete).toBe(true);
    expect(mockPrisma.enrollment.updateMany).toHaveBeenCalledTimes(1);
  });

  it("losing the enrollment.updateMany race returns courseComplete:false", async () => {
    // Two concurrent requests both pass the lessonProgress gate (one wins
    // create, the other wins updateMany). Both then hit the course-completion
    // block, but only one wins enrollment.updateMany — the other gets count=0
    // and skips the side effects.
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    const completedAt = new Date();
    mockPrisma.lessonProgress.create.mockResolvedValue({
      id: "lp1", userId: "user-1", lessonId: "l1", startedAt: completedAt, completedAt,
    });
    mockPrisma.module.findMany.mockResolvedValue([{ lessons: [{ id: "l1" }] }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    // Lost the race — another request already stamped enrollment.completedAt.
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "POST" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Lesson XP still awarded (this request did transition the lesson row).
    expect(body.xpAwarded).toBe(10);
    // But course-completion modal does NOT fire on the losing request —
    // the winning request's response carried that.
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
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

  it("returns 409 when course is locked at completed", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(validLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...baseEnrollment,
      completedAt: new Date("2026-02-01"),
    });
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/locked/i);
    // Must not have nulled any progress
    expect(mockPrisma.lessonProgress.updateMany).not.toHaveBeenCalled();
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
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
  });
});
