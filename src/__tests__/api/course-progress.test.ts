import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import("@/app/api/courses/[id]/progress/route");

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const makeLessonId = (n: number) => `lesson-${n}`;

describe("GET /api/courses/[id]/progress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns enrolled:false with zero progress when not enrolled", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.module.findMany.mockResolvedValue([
      {
        id: "m1",
        lessons: [{ id: makeLessonId(1) }, { id: makeLessonId(2) }],
      },
    ]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(false);
    expect(body.percentComplete).toBe(0);
    expect(body.completedLessons).toBe(0);
    expect(body.totalLessons).toBe(2);
  });

  it("returns 0% when enrolled but no lessons completed", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date("2026-01-01"),
    });
    mockPrisma.module.findMany.mockResolvedValue([
      {
        id: "m1",
        lessons: [{ id: makeLessonId(1) }, { id: makeLessonId(2) }],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(true);
    expect(body.percentComplete).toBe(0);
    expect(body.completedLessons).toBe(0);
    expect(body.totalLessons).toBe(2);
  });

  it("returns 50% when half the lessons are completed", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date("2026-01-01"),
    });
    mockPrisma.module.findMany.mockResolvedValue([
      {
        id: "m1",
        lessons: [
          { id: makeLessonId(1) },
          { id: makeLessonId(2) },
          { id: makeLessonId(3) },
          { id: makeLessonId(4) },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: makeLessonId(1), completedAt: new Date() },
      { lessonId: makeLessonId(2), completedAt: new Date() },
    ]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    const body = await res.json();
    expect(body.percentComplete).toBe(50);
    expect(body.completedLessons).toBe(2);
    expect(body.totalLessons).toBe(4);
  });

  it("returns 100% when all lessons are completed", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date("2026-01-01"),
    });
    mockPrisma.module.findMany.mockResolvedValue([
      { id: "m1", lessons: [{ id: makeLessonId(1) }, { id: makeLessonId(2) }] },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: makeLessonId(1), completedAt: new Date() },
      { lessonId: makeLessonId(2), completedAt: new Date() },
    ]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    const body = await res.json();
    expect(body.percentComplete).toBe(100);
    expect(body.completedLessons).toBe(2);
  });

  it("returns 0% without division by zero when course has no lessons", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date("2026-01-01"),
    });
    mockPrisma.module.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    const body = await res.json();
    expect(body.percentComplete).toBe(0);
    expect(body.totalLessons).toBe(0);
    expect(body.completedLessons).toBe(0);
  });

  it("returns correct per-lesson completed flags", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date("2026-01-01"),
    });
    mockPrisma.module.findMany.mockResolvedValue([
      {
        id: "m1",
        lessons: [{ id: "l1" }, { id: "l2" }, { id: "l3" }],
      },
    ]);
    const completedAt = new Date("2026-04-01T12:00:00Z");
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "l1", completedAt },
    ]);
    const req = new Request("http://localhost/api/courses/c1/progress");
    const res = await GET(req, makeParams("c1"));
    const body = await res.json();
    const l1 = body.lessons.find((l: { lessonId: string }) => l.lessonId === "l1");
    const l2 = body.lessons.find((l: { lessonId: string }) => l.lessonId === "l2");
    expect(l1.completed).toBe(true);
    expect(l1.completedAt).toBe(completedAt.toISOString());
    expect(l2.completed).toBe(false);
    expect(l2.completedAt).toBeNull();
  });
});
