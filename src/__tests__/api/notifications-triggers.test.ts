import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { PATCH } = await import("@/app/api/courses/[id]/route");
const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/route"
);

const courseParams = (id: string) => ({ params: Promise.resolve({ id }) });
const lessonParams = (id: string, moduleId: string) => ({
  params: Promise.resolve({ id, moduleId }),
});

const baseCourse = {
  id: "c1",
  title: "Test Course",
  description: null,
  thumbnail: null,
  status: "DRAFT" as const,
  createdById: "admin-id",
  createdBy: { name: "Admin", email: "admin@test.com" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Course publish notification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates notifications when course transitions DRAFT → PUBLISHED", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ ...baseCourse, status: "DRAFT" });
    mockPrisma.course.update.mockResolvedValue({ ...baseCourse, status: "PUBLISHED" });
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    const res = await PATCH(req, courseParams("c1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseId: "c1" } })
    );
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", type: "course_published" }),
          expect.objectContaining({ userId: "u2", type: "course_published" }),
        ]),
      })
    );
  });

  it("does NOT create notifications when course is already PUBLISHED", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ ...baseCourse, status: "PUBLISHED" });
    mockPrisma.course.update.mockResolvedValue({ ...baseCourse, status: "PUBLISHED" });

    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    await PATCH(req, courseParams("c1"));

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("does NOT create notifications when publishing to non-published status", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ ...baseCourse, status: "PUBLISHED" });
    mockPrisma.course.update.mockResolvedValue({ ...baseCourse, status: "ARCHIVED" });

    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    await PATCH(req, courseParams("c1"));

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("New lesson notification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates notifications when lesson added to PUBLISHED course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ ...baseCourse, status: "PUBLISHED" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "mod1", courseId: "c1" });
    mockPrisma.lesson.findFirst.mockResolvedValue({ order: 2 });
    mockPrisma.lesson.create.mockResolvedValue({
      id: "l1",
      title: "Brand New Lesson",
      type: "TEXT",
      content: null,
      order: 3,
      moduleId: "mod1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.enrollment.findMany.mockResolvedValue([{ userId: "u1" }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    const req = new Request(
      "http://localhost/api/courses/c1/modules/mod1/lessons",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Brand New Lesson", type: "text" }),
      }
    );
    const res = await POST(req, lessonParams("c1", "mod1"));

    expect(res.status).toBe(201);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", type: "new_lesson" }),
        ]),
      })
    );
  });

  it("does NOT create notifications when lesson added to DRAFT course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ ...baseCourse, status: "DRAFT" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "mod1", courseId: "c1" });
    mockPrisma.lesson.findFirst.mockResolvedValue(null);
    mockPrisma.lesson.create.mockResolvedValue({
      id: "l1",
      title: "Draft Lesson",
      type: "TEXT",
      content: null,
      order: 1,
      moduleId: "mod1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new Request(
      "http://localhost/api/courses/c1/modules/mod1/lessons",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Draft Lesson", type: "text" }),
      }
    );
    await POST(req, lessonParams("c1", "mod1"));

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});
