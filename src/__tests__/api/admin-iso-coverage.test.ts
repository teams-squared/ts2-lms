import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET } = await import("@/app/api/admin/iso-coverage/route");

const sampleLesson = {
  id: "l1",
  title: "Quality Manual",
  module: {
    courseId: "c1",
    course: {
      title: "Quality Management",
      enrollments: [
        {
          enrolledAt: new Date("2026-01-01"),
          user: { id: "u1", name: "Alice", email: "alice@t.com", role: "EMPLOYEE" },
        },
        {
          enrolledAt: new Date("2026-01-02"),
          user: { id: "u2", name: "Bob", email: "bob@t.com", role: "EMPLOYEE" },
        },
        {
          enrolledAt: new Date("2026-01-03"),
          user: { id: "u3", name: "Carol", email: "carol@t.com", role: "EMPLOYEE" },
        },
      ],
    },
  },
  policyDoc: {
    documentTitle: "Quality Manual",
    documentCode: "QM-001",
    sourceVersion: "v2",
    sourceETag: "etag-v2",
  },
  progress: [
    // u1 ack'd current version
    {
      userId: "u1",
      acknowledgedAt: new Date("2026-04-15T10:00:00Z"),
      acknowledgedVersion: "v2",
    },
    // u2 ack'd a prior version only — outstanding
    {
      userId: "u2",
      acknowledgedAt: new Date("2026-02-01T10:00:00Z"),
      acknowledgedVersion: "v1",
    },
    // u3 has no ack at all — also outstanding
  ],
};

describe("GET /api/admin/iso-coverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockPrisma.lesson.findMany).not.toHaveBeenCalled();
  });

  it("computes per-policy coverage with outstanding drill-down", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lesson.findMany.mockResolvedValue([sampleLesson]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.policies).toHaveLength(1);
    const row = body.policies[0];
    expect(row.lessonId).toBe("l1");
    expect(row.documentTitle).toBe("Quality Manual");
    expect(row.currentVersion).toBe("v2");
    expect(row.enrolledCount).toBe(3);
    expect(row.ackedCount).toBe(1); // only u1
    expect(row.outstandingCount).toBe(2);

    const outstandingIds = row.outstanding.map((u: { userId: string }) => u.userId);
    expect(outstandingIds).toEqual(expect.arrayContaining(["u2", "u3"]));
    expect(outstandingIds).not.toContain("u1");

    const u2 = row.outstanding.find(
      (u: { userId: string }) => u.userId === "u2",
    );
    expect(u2.lastSeenAckVersion).toBe("v1"); // prior ack surfaced
    const u3 = row.outstanding.find(
      (u: { userId: string }) => u.userId === "u3",
    );
    expect(u3.lastSeenAckVersion).toBeNull(); // never ack'd
  });

  it("filters out lessons that lack a policyDoc row", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lesson.findMany.mockResolvedValue([
      { ...sampleLesson, policyDoc: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.policies).toHaveLength(0);
  });

  it("treats a course with no enrollments as 100% coverage", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lesson.findMany.mockResolvedValue([
      {
        ...sampleLesson,
        module: {
          ...sampleLesson.module,
          course: { ...sampleLesson.module.course, enrollments: [] },
        },
        progress: [],
      },
    ]);
    const res = await GET();
    const body = await res.json();
    const row = body.policies[0];
    expect(row.enrolledCount).toBe(0);
    expect(row.outstandingCount).toBe(0);
  });
});
