import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const lessonRoute = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route"
);
const lessonsRoute = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/route"
);

const makeLessonParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const makeLessonsParams = (id: string, moduleId: string) => ({
  params: Promise.resolve({ id, moduleId }),
});

describe("GET /api/courses/[id]/modules/[moduleId]/lessons/[lessonId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1");
    const res = await lessonRoute.GET(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when lesson not found", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1");
    const res = await lessonRoute.GET(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns lesson detail for authenticated user", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      title: "Lesson 1",
      type: "TEXT",
      content: "# Hello",
      order: 1,
      moduleId: "m1",
      module: { courseId: "c1" },
    });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1");
    const res = await lessonRoute.GET(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("text");
    expect(body.content).toBe("# Hello");
  });
});

describe("POST /api/courses/[id]/modules/[moduleId]/lessons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({ title: "New Lesson" }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(401);
  });

  it("creates lesson for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    mockPrisma.lesson.findFirst.mockResolvedValue(null);
    mockPrisma.lesson.create.mockResolvedValue({
      id: "l-new",
      title: "New Lesson",
      type: "TEXT",
      content: null,
      order: 1,
      moduleId: "m1",
    });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({ title: "New Lesson" }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("New Lesson");
    expect(body.type).toBe("text");
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(400);
  });

  it("validates lesson type", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({ title: "Lesson", type: "invalid" }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(400);
  });

  it("creates document lesson with valid SharePointDocumentRef", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    mockPrisma.lesson.findFirst.mockResolvedValue(null);
    mockPrisma.lesson.create.mockResolvedValue({
      id: "l-doc",
      title: "Security Policy",
      type: "DOCUMENT",
      content: JSON.stringify({ driveId: "d1", itemId: "i1", fileName: "policy.pdf", mimeType: "application/pdf" }),
      order: 1,
      moduleId: "m1",
    });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({
        title: "Security Policy",
        type: "document",
        content: JSON.stringify({ driveId: "d1", itemId: "i1", fileName: "policy.pdf", mimeType: "application/pdf" }),
      }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("document");
  });

  it("returns 400 for document lesson with invalid JSON content", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons", {
      method: "POST",
      body: JSON.stringify({ title: "Doc", type: "document", content: "not-valid-json" }),
    });
    const res = await lessonsRoute.POST(req, makeLessonsParams("c1", "m1"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/courses/[id]/modules/[moduleId]/lessons/[lessonId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-owner employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-2", role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await lessonRoute.PATCH(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(403);
  });

  it("updates lesson for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.lesson.findUnique.mockResolvedValue({ id: "l1", title: "Old", type: "TEXT" });
    mockPrisma.lesson.update.mockResolvedValue({
      id: "l1",
      title: "Updated",
      type: "TEXT",
      content: "New content",
    });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated", content: "New content" }),
    });
    const res = await lessonRoute.PATCH(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated");
  });
});

describe("DELETE /api/courses/[id]/modules/[moduleId]/lessons/[lessonId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes lesson for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.lesson.delete.mockResolvedValue({ id: "l1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1", {
      method: "DELETE",
    });
    const res = await lessonRoute.DELETE(req, makeLessonParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
