import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockTrackEvent = vi.fn();
vi.mock("@/lib/posthog-server", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { DELETE } = await import("@/app/api/admin/users/[userId]/route");

const makeReq = () =>
  new Request("http://localhost/api/admin/users/u1", { method: "DELETE" });

const callDelete = (userId: string) =>
  DELETE(makeReq(), { params: Promise.resolve({ userId }) });

function makeMockTx() {
  return {
    course: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    policyDocLesson: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { delete: vi.fn().mockResolvedValue({}) },
  };
}

describe("DELETE /api/admin/users/[userId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when requireRole rejects (non-admin)", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await callDelete("u1");
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
  });

  it("returns 409 when admin tries to delete self", async () => {
    mockRequireRole.mockResolvedValue({ userId: "u1", role: "admin" });
    const res = await callDelete("u1");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/own account/i);
    // Shouldn't even look up the target
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when target user not found", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await callDelete("missing");
    expect(res.status).toBe(404);
  });

  it("returns 409 when removing the last admin", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "last@t.com",
      role: "ADMIN",
    });
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await callDelete("u2");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/last admin/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows removing an admin when more than one admin exists", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "other@t.com",
      role: "ADMIN",
    });
    mockPrisma.user.count.mockResolvedValue(2);
    mockPrisma.enrollment.count.mockResolvedValue(3);
    mockPrisma.course.count.mockResolvedValue(1);

    const mockTx = makeMockTx();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const res = await callDelete("u2");
    expect(res.status).toBe(200);
    expect(mockTx.course.updateMany).toHaveBeenCalledWith({
      where: { createdById: "u2" },
      data: { createdById: "admin-1" },
    });
    expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });
  });

  it("hard-deletes with course reassignment — happy path", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "nadun@t.com",
      role: "EMPLOYEE",
    });
    mockPrisma.enrollment.count.mockResolvedValue(5);
    mockPrisma.course.count.mockResolvedValue(2);

    const mockTx = makeMockTx();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    // Default policy-doc count is 0 (mock); see below for the case where
    // the demo admin had synced policy docs.
    const res = await callDelete("u2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      deleted: true,
      reassignedCourseCount: 2,
      reassignedPolicyDocSyncCount: 0,
      enrollmentCount: 5,
    });

    // Reassign then delete, both on tx (not prisma directly)
    expect(mockTx.course.updateMany).toHaveBeenCalledWith({
      where: { createdById: "u2" },
      data: { createdById: "admin-1" },
    });
    expect(mockTx.policyDocLesson.updateMany).toHaveBeenCalledWith({
      where: { lastSyncedById: "u2" },
      data: { lastSyncedById: "admin-1" },
    });
    expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });

    // Last-admin guard should NOT run when target is EMPLOYEE
    expect(mockPrisma.user.count).not.toHaveBeenCalled();

    // PostHog event
    expect(mockTrackEvent).toHaveBeenCalledWith("admin-1", "user_removed", {
      targetId: "u2",
      targetEmail: "nadun@t.com",
      targetRole: "EMPLOYEE",
      reassignedCourseCount: 2,
      reassignedPolicyDocSyncCount: 0,
      enrollmentCount: 5,
    });
  });

  it("calls updateMany even when the user authored no courses (no-op safe)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "e@t.com",
      role: "EMPLOYEE",
    });
    mockPrisma.enrollment.count.mockResolvedValue(0);
    mockPrisma.course.count.mockResolvedValue(0);

    const mockTx = makeMockTx();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const res = await callDelete("u2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reassignedCourseCount).toBe(0);
    expect(body.reassignedPolicyDocSyncCount).toBe(0);
    expect(mockTx.course.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.policyDocLesson.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.user.delete).toHaveBeenCalledTimes(1);
  });

  it("reassigns policy-doc sync history when target had synced any", async () => {
    // Repro of the production bug we hit deleting demo admins:
    // User_x had synced one or more policy docs, leaving
    // PolicyDocLesson.lastSyncedById pointing at them. Without this
    // reassignment in the same tx, the user-delete fails with
    // FK-constraint "PolicyDocLesson_lastSyncedById_fkey".
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "demo-admin@t.com",
      role: "ADMIN",
    });
    mockPrisma.user.count.mockResolvedValue(2); // not last admin
    mockPrisma.enrollment.count.mockResolvedValue(0);
    mockPrisma.course.count.mockResolvedValue(0);
    mockPrisma.policyDocLesson.count.mockResolvedValue(3); // synced 3 docs

    const mockTx = makeMockTx();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const res = await callDelete("u2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reassignedPolicyDocSyncCount).toBe(3);
    expect(mockTx.policyDocLesson.updateMany).toHaveBeenCalledWith({
      where: { lastSyncedById: "u2" },
      data: { lastSyncedById: "admin-1" },
    });
    expect(mockTx.user.delete).toHaveBeenCalled();
  });
});
