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
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      module: { courseId: "c1" },
    });
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
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      module: { courseId: "c1" },
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date(),
    });
    const completedAt = new Date("2026-04-13T10:00:00Z");
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: completedAt,
      completedAt,
    });
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/complete",
      { method: "POST" },
    );
    const res = await POST(req, makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(body.completedAt).toBeTruthy();
  });

  it("is idempotent — calling POST twice both return 200", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      module: { courseId: "c1" },
    });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt: new Date(),
    });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: new Date(),
      completedAt: new Date(),
    });

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

  const validLesson = { id: "l1", moduleId: "m1", module: { courseId: "c1" } };
  const validEnrollment = { id: "e1", userId: "user-1", courseId: "c1", enrolledAt: new Date() };

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
    mockPrisma.enrollment.findUnique.mockResolvedValue(validEnrollment);
    mockPrisma.lessonProgress.updateMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(
      new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", { method: "DELETE" }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(false);
  });
});
