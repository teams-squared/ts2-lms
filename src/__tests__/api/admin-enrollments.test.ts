import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/xp", () => ({
  awardXp: vi.fn().mockResolvedValue({ newAchievements: [] }),
}));
vi.mock("@/lib/posthog-server", () => ({
  trackEvent: vi.fn(),
}));

const routeModule = await import("@/app/api/admin/enrollments/route");
const { GET, POST } = routeModule;

describe("GET /api/admin/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns enrollments list for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.enrollment.findMany.mockResolvedValue([
      {
        id: "e1",
        userId: "u1",
        courseId: "c1",
        enrolledAt: new Date(),
        user: { id: "u1", name: "User One", email: "u1@test.com" },
        course: { id: "c1", title: "Course One" },
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("e1");
  });

  it("returns enrollments list for course_manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  const makeReq = (body: Record<string, unknown>) =>
    new Request("http://localhost/api/admin/enrollments", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when courseId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const res = await POST(makeReq({ userId: "u1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when userId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const res = await POST(makeReq({ courseId: "c1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", title: "Course" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when enrollment already exists", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", title: "Course" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "User" });
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: "e-existing" });
    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(409);
  });

  it("creates enrollment and notification for valid request", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", title: "Course One" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "User One" });
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.enrollment.create.mockResolvedValue({
      id: "e-new",
      userId: "u1",
      courseId: "c1",
      enrolledAt: new Date(),
      user: { id: "u1", name: "User One", email: "u1@test.com" },
      course: { id: "c1", title: "Course One" },
    });
    mockPrisma.notification.create.mockResolvedValue({});

    const res = await POST(makeReq({ courseId: "c1", userId: "u1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("e-new");

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "enrollment",
          userId: "u1",
          courseId: "c1",
        }),
      }),
    );
  });
});
