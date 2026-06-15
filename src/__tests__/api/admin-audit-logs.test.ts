import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import("@/app/api/admin/audit-logs/route");
const { GET: EXPORT } = await import(
  "@/app/api/admin/audit-logs/export/route"
);

const adminSession = () => mockSession({ id: "admin-id", role: "admin" });

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    const res = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(res.status).toBe(401);
  });

  it("returns rows + total, newest-first, default pagination", async () => {
    mockAuth.mockResolvedValue(adminSession());
    const rows = [{ id: "a1", action: "user.role_changed" }];
    mockPrisma.auditLog.findMany.mockResolvedValue(rows);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const res = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ rows, total: 1, limit: 100, offset: 0 });
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 100,
        skip: 0,
      }),
    );
  });

  it("applies action + actor filters and clamps limit to 500", async () => {
    mockAuth.mockResolvedValue(adminSession());
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.count.mockResolvedValue(0);

    await GET(
      new Request(
        "http://localhost/api/admin/audit-logs?action=clearance.granted&actorId=admin-id&limit=9999",
      ),
    );
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: "clearance.granted", actorId: "admin-id" },
        take: 500,
      }),
    );
  });

  it("rejects an invalid `from` date", async () => {
    mockAuth.mockResolvedValue(adminSession());
    const res = await GET(
      new Request("http://localhost/api/admin/audit-logs?from=not-a-date"),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/audit-logs/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await EXPORT(
      new Request("http://localhost/api/admin/audit-logs/export"),
    );
    expect(res.status).toBe(403);
  });

  it("streams a CSV with header + one row per log, escaping metadata", async () => {
    mockAuth.mockResolvedValue(adminSession());
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        action: "user.role_changed",
        actorEmail: "admin@teamssquared.com",
        targetType: "user",
        targetId: "u1",
        metadata: { oldRole: "employee", newRole: "admin" },
        actor: { name: "Admin One", email: "admin@teamssquared.com" },
      },
    ]);

    const res = await EXPORT(
      new Request("http://localhost/api/admin/audit-logs/export"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="audit-logs-\d{4}-\d{2}-\d{2}\.csv"/,
    );

    const text = await res.text();
    const lines = text.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "createdAt,action,actorEmail,actorName,targetType,targetId,metadata",
    );
    // metadata JSON contains a comma → must be quoted with interior quotes doubled.
    expect(lines[1]).toContain(
      '"{""oldRole"":""employee"",""newRole"":""admin""}"',
    );
    expect(lines[1]).toContain("user.role_changed");
  });
});
