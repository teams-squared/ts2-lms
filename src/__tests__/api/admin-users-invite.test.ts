import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockSendInvite = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/email", () => ({
  sendUserInviteEmail: (...args: unknown[]) => mockSendInvite(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { POST } = await import("@/app/api/admin/users/invite/route");

const makeReq = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/admin/users/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

function makeMockTx() {
  return {
    user: { create: vi.fn() },
    course: { findMany: vi.fn().mockResolvedValue([]) },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("POST /api/admin/users/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendInvite.mockResolvedValue(true);
  });

  it("returns 403 for unauthorized", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await POST(makeReq({ email: "new@test.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing email", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await POST(makeReq({ email: "new@test.com", role: "superuser" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when course_manager tries to invite admin", async () => {
    mockRequireRole.mockResolvedValue({ userId: "cm-1", role: "course_manager" });
    const res = await POST(
      makeReq({ email: "new@test.com", role: "admin" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 for duplicate email", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing",
      email: "dup@test.com",
    });
    const res = await POST(makeReq({ email: "dup@test.com" }));
    expect(res.status).toBe(409);
  });

  it("creates user without courses (happy path, no enrollments)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    // First findUnique = duplicate check (no existing), second = inviter lookup
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // duplicate check
      .mockResolvedValueOnce({ name: "Admin One", email: "admin@t.com" }); // inviter

    const mockTx = makeMockTx();
    mockTx.user.create.mockResolvedValue({
      id: "new-1",
      email: "newhire@test.com",
      name: null,
      role: "EMPLOYEE",
      createdAt: new Date(),
    });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const res = await POST(makeReq({ email: "newhire@test.com" }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user.email).toBe("newhire@test.com");
    expect(body.enrollmentCount).toBe(0);
    expect(body.emailSent).toBe(true);
    expect(mockSendInvite).toHaveBeenCalledWith({
      to: "newhire@test.com",
      inviterName: "Admin One",
      assignedCourses: [],
    });
    // No enrollments attempted
    expect(mockTx.enrollment.create).not.toHaveBeenCalled();
  });

  it("creates user and pre-enrolls in courses", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: "Admin", email: "admin@t.com" });

    const mockTx = makeMockTx();
    mockTx.user.create.mockResolvedValue({
      id: "new-1",
      email: "hire@test.com",
      name: "Hire",
      role: "EMPLOYEE",
      createdAt: new Date(),
    });
    mockTx.course.findMany.mockResolvedValue([
      { id: "c1", title: "Onboarding" },
      { id: "c2", title: "Safety" },
    ]);
    mockTx.enrollment.findMany.mockResolvedValue([]);
    mockTx.enrollment.create
      .mockResolvedValueOnce({
        id: "e1",
        enrolledAt: new Date(),
        user: { id: "new-1", name: "Hire", email: "hire@test.com" },
        course: { id: "c1", title: "Onboarding" },
      })
      .mockResolvedValueOnce({
        id: "e2",
        enrolledAt: new Date(),
        user: { id: "new-1", name: "Hire", email: "hire@test.com" },
        course: { id: "c2", title: "Safety" },
      });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const res = await POST(
      makeReq({ email: "hire@test.com", name: "Hire", courseIds: ["c1", "c2"] }),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.enrollmentCount).toBe(2);
    expect(body.assignedCourseTitles).toEqual(["Onboarding", "Safety"]);
    expect(mockSendInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "hire@test.com",
        assignedCourses: ["Onboarding", "Safety"],
      }),
    );
  });

  it("does not fail the request if email delivery throws", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: "Admin", email: "a@t.com" });

    const mockTx = makeMockTx();
    mockTx.user.create.mockResolvedValue({
      id: "new-1",
      email: "hire@test.com",
      name: null,
      role: "EMPLOYEE",
      createdAt: new Date(),
    });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );
    mockSendInvite.mockRejectedValueOnce(new Error("Resend down"));

    const res = await POST(makeReq({ email: "hire@test.com" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.user.id).toBe("new-1");
  });

  it("normalizes email to lowercase + trims", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: "Admin", email: "a@t.com" });

    const mockTx = makeMockTx();
    mockTx.user.create.mockResolvedValue({
      id: "new-1",
      email: "hire@test.com",
      name: null,
      role: "EMPLOYEE",
      createdAt: new Date(),
    });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    await POST(makeReq({ email: "  HIRE@Test.COM  " }));
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "hire@test.com" },
    });
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "hire@test.com" }),
      }),
    );
  });
});
