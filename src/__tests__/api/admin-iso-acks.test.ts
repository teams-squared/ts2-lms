import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET } = await import("@/app/api/admin/iso-acks/route");

const sampleRow = {
  id: "lp1",
  acknowledgedAt: new Date("2026-04-30T12:00:00Z"),
  acknowledgedVersion: "2.3.1",
  acknowledgedETag: "etag-abc",
  acknowledgedHash: "hash-deadbeef",
  acknowledgedAttestationText: "I have read and understood Quality Manual v2.3.1.",
  acknowledgedDwellSeconds: 372,
  acknowledgedSharePointItemId: "01ABCD",
  user: { id: "u1", name: "Nadun", email: "nadun@t.com" },
  lesson: {
    id: "l1",
    title: "Quality Manual",
    module: { course: { title: "Quality Management" } },
    policyDoc: {
      documentTitle: "Quality Manual",
      documentCode: "QM-001",
      sourceVersion: "2.3.1",
    },
  },
};

const makeReq = (qs: string = "") =>
  new Request(`http://localhost/api/admin/iso-acks${qs ? `?${qs}` : ""}`);

describe("GET /api/admin/iso-acks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });

  it("returns acks ordered desc with pagination defaults", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([sampleRow]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.acks).toHaveLength(1);
    expect(body.acks[0]).toMatchObject({
      id: "lp1",
      employee: { id: "u1", name: "Nadun", email: "nadun@t.com" },
      courseTitle: "Quality Management",
      documentTitle: "Quality Manual",
      documentCode: "QM-001",
      documentVersion: "2.3.1",
      auditHash: "hash-deadbeef",
      auditETag: "etag-abc",
      attestationText: "I have read and understood Quality Manual v2.3.1.",
      dwellSeconds: 372,
      sourceItemId: "01ABCD",
    });

    const findArgs = mockPrisma.lessonProgress.findMany.mock.calls[0][0];
    expect(findArgs.orderBy).toEqual({ acknowledgedAt: "desc" });
    expect(findArgs.skip).toBe(0);
    expect(findArgs.take).toBe(50);
    // Both filters present: not-null acknowledgedAt + POLICY_DOC type.
    expect(findArgs.where.acknowledgedAt).toMatchObject({ not: null });
    expect(findArgs.where.lesson).toEqual({ type: "POLICY_DOC" });
  });

  it("applies from/to filters as gte/lte against acknowledgedAt", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.count.mockResolvedValue(0);

    await GET(makeReq("from=2026-04-01T00:00:00Z&to=2026-04-30T23:59:59Z"));
    const where = mockPrisma.lessonProgress.findMany.mock.calls[0][0].where;
    expect(where.acknowledgedAt.gte).toBeInstanceOf(Date);
    expect(where.acknowledgedAt.lte).toBeInstanceOf(Date);
    expect(where.acknowledgedAt.gte.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
    expect(where.acknowledgedAt.lte.toISOString()).toBe(
      "2026-04-30T23:59:59.000Z",
    );
  });

  it("rejects invalid date strings with 400", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await GET(makeReq("from=not-a-date"));
    expect(res.status).toBe(400);
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });

  it("paginates correctly: page 3 of size 25 → skip 50, take 25", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.count.mockResolvedValue(120);

    await GET(makeReq("page=3&pageSize=25"));
    const findArgs = mockPrisma.lessonProgress.findMany.mock.calls[0][0];
    expect(findArgs.skip).toBe(50);
    expect(findArgs.take).toBe(25);
  });

  it("caps pageSize at 200", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.count.mockResolvedValue(0);

    await GET(makeReq("pageSize=9999"));
    const findArgs = mockPrisma.lessonProgress.findMany.mock.calls[0][0];
    expect(findArgs.take).toBe(200);
  });

  it("falls back to lesson.title when policyDoc is missing", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const orphan = {
      ...sampleRow,
      lesson: {
        ...sampleRow.lesson,
        title: "Legacy lesson",
        policyDoc: null,
      },
    };
    mockPrisma.lessonProgress.findMany.mockResolvedValue([orphan]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.acks[0].documentTitle).toBe("Legacy lesson");
    expect(body.acks[0].documentCode).toBeNull();
    // Falls back to acknowledgedVersion snapshot since policyDoc.sourceVersion
    // is unavailable.
    expect(body.acks[0].documentVersion).toBe("2.3.1");
  });
});
