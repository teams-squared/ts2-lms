import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import("@/app/api/courses/[id]/enroll/route");

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/courses/[id]/enroll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when employee tries to enroll in a DRAFT course", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      status: "DRAFT",
      createdById: "other-user",
    });
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and enrolls user in a PUBLISHED course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      status: "PUBLISHED",
      createdById: "other-user",
    });
    const enrolledAt = new Date("2026-01-01T00:00:00Z");
    mockPrisma.enrollment.upsert.mockResolvedValue({
      id: "enroll-1",
      userId: "user-1",
      courseId: "c1",
      enrolledAt,
    });
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(true);
    expect(body.enrolledAt).toBe(enrolledAt.toISOString());
  });

  it("is idempotent — returns 200 when already enrolled", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      status: "PUBLISHED",
      createdById: "other-user",
    });
    const enrolledAt = new Date("2025-12-01T00:00:00Z");
    mockPrisma.enrollment.upsert.mockResolvedValue({
      id: "enroll-existing",
      userId: "user-1",
      courseId: "c1",
      enrolledAt,
    });
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(true);
  });

  it("allows admin to enroll in a DRAFT course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      status: "DRAFT",
      createdById: "other-user",
    });
    mockPrisma.enrollment.upsert.mockResolvedValue({
      id: "enroll-admin",
      userId: "admin-1",
      courseId: "c1",
      enrolledAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(true);
  });

  it("allows course creator to enroll in their own DRAFT course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "creator-1", role: "manager" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      status: "DRAFT",
      createdById: "creator-1",
    });
    mockPrisma.enrollment.upsert.mockResolvedValue({
      id: "enroll-creator",
      userId: "creator-1",
      courseId: "c1",
      enrolledAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(200);
  });
});
