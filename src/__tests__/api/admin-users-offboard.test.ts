import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockWriteAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const { POST, DELETE } = await import(
  "@/app/api/admin/users/[userId]/offboard/route"
);

const makeReq = (method: string) =>
  new Request("http://localhost/api/admin/users/u1/offboard", { method });

const callPost = (userId: string) =>
  POST(makeReq("POST"), { params: Promise.resolve({ userId }) });
const callDelete = (userId: string) =>
  DELETE(makeReq("DELETE"), { params: Promise.resolve({ userId }) });

function wireTransaction() {
  const tx = {
    user: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  mockPrisma.$transaction.mockImplementation(
    async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  );
  return tx;
}

describe("POST /api/admin/users/[userId]/offboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when requireRole rejects (non-admin)", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await callPost("u1");
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
  });

  it("returns 409 when admin offboards self", async () => {
    mockRequireRole.mockResolvedValue({ userId: "u1", role: "admin" });
    const res = await callPost("u1");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/own account/i);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when target not found", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await callPost("missing");
    expect(res.status).toBe(404);
  });

  it("returns 409 when offboarding the last admin", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "last@t.com",
      role: "ADMIN",
      offboardedAt: null,
    });
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await callPost("u2");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/last admin/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 409 when user is already offboarded", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "gone@t.com",
      role: "EMPLOYEE",
      offboardedAt: new Date(),
    });
    const res = await callPost("u2");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already offboarded/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("offboards an active user and writes a manual audit row", async () => {
    mockRequireRole.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      session: { user: { email: "admin@t.com" } },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "leaver@t.com",
      role: "EMPLOYEE",
      offboardedAt: null,
    });
    const tx = wireTransaction();

    const res = await callPost("u2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ offboarded: true });

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: expect.objectContaining({ offboardedAt: expect.any(Date) }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.offboarded",
        actorId: "admin-1",
        targetId: "u2",
        metadata: expect.objectContaining({ source: "manual" }),
      }),
      tx,
    );
    // last-admin guard must NOT run for an EMPLOYEE target
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/users/[userId]/offboard (reactivate)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when target not found", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await callDelete("missing");
    expect(res.status).toBe(404);
  });

  it("returns 409 when user is not offboarded", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "active@t.com",
      role: "EMPLOYEE",
      offboardedAt: null,
    });
    const res = await callDelete("u2");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not offboarded/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("reactivates an offboarded user and clears offboardedAt", async () => {
    mockRequireRole.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      session: { user: { email: "admin@t.com" } },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "returner@t.com",
      role: "EMPLOYEE",
      offboardedAt: new Date(),
    });
    const tx = wireTransaction();

    const res = await callDelete("u2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reactivated: true });

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: { offboardedAt: null },
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.reactivated",
        actorId: "admin-1",
        targetId: "u2",
      }),
      tx,
    );
  });
});
