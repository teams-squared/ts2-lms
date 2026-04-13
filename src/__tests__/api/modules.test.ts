import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, POST } = await import("@/app/api/courses/[id]/modules/route");

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/courses/[id]/modules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules");
    const res = await GET(req, makeParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns modules with lessons for authenticated user", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.module.findMany.mockResolvedValue([
      {
        id: "m1",
        title: "Module 1",
        order: 1,
        courseId: "c1",
        lessons: [
          { id: "l1", title: "Lesson 1", type: "TEXT", order: 1 },
        ],
      },
    ]);
    const req = new Request("http://localhost/api/courses/c1/modules");
    const res = await GET(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].lessons[0].type).toBe("text");
  });
});

describe("POST /api/courses/[id]/modules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "New Module" }),
    });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "New Module" }),
    });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-owner employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-2", role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      createdById: "user-1",
    });
    const req = new Request("http://localhost/api/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "New Module" }),
    });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    const req = new Request("http://localhost/api/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "  " }),
    });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(400);
  });

  it("creates module for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findFirst.mockResolvedValue({ order: 2 });
    mockPrisma.module.create.mockResolvedValue({
      id: "m-new",
      title: "New Module",
      order: 3,
      courseId: "c1",
    });
    const req = new Request("http://localhost/api/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "New Module" }),
    });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("New Module");
    expect(body.order).toBe(3);
  });
});
