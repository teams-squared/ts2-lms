import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, POST } = await import("@/app/api/admin/assignments/route");

describe("GET /api/admin/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "emp-id", role: "employee" }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns assignments list for admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.assignment.findMany.mockResolvedValue([
      {
        id: "a1",
        courseId: "c1",
        userId: "u1",
        assignedById: "admin-id",
        assignedAt: new Date(),
        user: { id: "u1", name: "User One", email: "u1@test.com" },
        course: { id: "c1", title: "Course One" },
        assignedBy: {
          id: "admin-id",
          name: "Admin",
          email: "admin@test.com",
        },
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("a1");
  });
});

describe("POST /api/admin/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "emp-id", role: "employee" }));
    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when courseId is missing", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when userId is missing", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Test Course",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 409 when assignment already exists", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Test Course",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "User One",
    });
    mockPrisma.assignment.findUnique.mockResolvedValue({
      id: "a-existing",
      courseId: "c1",
      userId: "u1",
    });

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("creates assignment and notification for valid request", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Test Course",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "User One",
    });
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    mockPrisma.assignment.create.mockResolvedValue({
      id: "a-new",
      courseId: "c1",
      userId: "u1",
      assignedById: "admin-id",
      user: { id: "u1", name: "User One", email: "u1@test.com" },
      course: { id: "c1", title: "Test Course" },
    });
    mockPrisma.notification.create.mockResolvedValue({});

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ courseId: "c1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe("a-new");

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "assignment",
          userId: "u1",
          courseId: "c1",
        }),
      }),
    );
  });
});
