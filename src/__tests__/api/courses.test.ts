import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, POST } = await import("@/app/api/courses/route");

describe("GET /api/courses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns published courses for employee", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ role: "employee", email: "emp@test.com" })
    );
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course 1",
        description: null,
        thumbnail: null,
        status: "PUBLISHED",
        createdBy: { name: "Admin", email: "admin@test.com" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const req = new Request("http://localhost/api/courses");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("published");
  });
});

describe("POST /api/courses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty title", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates course for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.create.mockResolvedValue({
      id: "c1",
      title: "New Course",
      description: "Desc",
      thumbnail: null,
      status: "DRAFT",
      createdBy: { name: "Test User", email: "test@teamssquared.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Course", description: "Desc" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("New Course");
    expect(body.status).toBe("draft");
  });

  it("creates course for manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    mockPrisma.course.create.mockResolvedValue({
      id: "c2",
      title: "Manager Course",
      description: null,
      thumbnail: null,
      status: "DRAFT",
      createdBy: { name: "Test User", email: "test@teamssquared.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Manager Course" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("passes nodeId when creating course", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.create.mockResolvedValue({
      id: "c3",
      title: "Node Course",
      description: null,
      thumbnail: null,
      status: "DRAFT",
      nodeId: "node-1",
      createdBy: { name: "Test User", email: "test@teamssquared.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Node Course", nodeId: "node-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.course.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nodeId: "node-1" }),
      }),
    );
  });
});
