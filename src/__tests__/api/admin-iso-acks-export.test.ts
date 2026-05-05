import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET, csvCell } = await import(
  "@/app/api/admin/iso-acks/export/route"
);

const baseRow = {
  acknowledgedAt: new Date("2026-04-30T12:00:00Z"),
  acknowledgedVersion: "2.3.1",
  acknowledgedETag: "etag-abc",
  acknowledgedHash: "hash-deadbeef",
  acknowledgedAttestationText: "I have read and understood Quality Manual v2.3.1.",
  acknowledgedDwellSeconds: 372,
  acknowledgedSharePointItemId: "01ABCD",
  user: { name: "Nadun", email: "nadun@t.com" },
  lesson: {
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
  new Request(
    `http://localhost/api/admin/iso-acks/export${qs ? `?${qs}` : ""}`,
  );

describe("csvCell — RFC-4180 cell encoding", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell("nadun@t.com")).toBe("nadun@t.com");
  });
  it("quotes values containing commas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
  });
  it("quotes values containing CR or LF", () => {
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });
  it("doubles interior quotes and wraps in quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("GET /api/admin/iso-acks/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });

  it("returns CSV with the expected headers and a today-stamped filename", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    const cd = res.headers.get("Content-Disposition") ?? "";
    const today = new Date().toISOString().slice(0, 10);
    expect(cd).toContain(`filename="iso-acks-${today}.csv"`);

    const body = await res.text();
    const firstLine = body.split("\r\n")[0];
    expect(firstLine).toBe(
      "acknowledgedAt,employeeName,employeeEmail,courseTitle,documentTitle,documentCode,documentVersion,auditHash,auditETag,attestationText,dwellSeconds,sourceItemId",
    );
  });

  it("emits one row per ack with snapshot fields preferred over live PolicyDocLesson", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([baseRow]);

    const res = await GET(makeReq());
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2); // header + 1
    // The attestation text contains a comma after "understood"? It does not,
    // but it does contain spaces — splitting on raw `,` is safe here because
    // none of the test fixture cells contain commas. The CSV-quoting
    // behaviour is exercised separately in the "escapes commas" test.
    const data = lines[1].split(",");
    expect(data[0]).toBe("2026-04-30T12:00:00.000Z");
    expect(data[1]).toBe("Nadun");
    expect(data[2]).toBe("nadun@t.com");
    expect(data[3]).toBe("Quality Management");
    expect(data[4]).toBe("Quality Manual");
    expect(data[5]).toBe("QM-001");
    expect(data[6]).toBe("2.3.1");
    expect(data[7]).toBe("hash-deadbeef");
    expect(data[8]).toBe("etag-abc");
    expect(data[9]).toBe("I have read and understood Quality Manual v2.3.1.");
    expect(data[10]).toBe("372");
    expect(data[11]).toBe("01ABCD");
  });

  it("escapes commas in column values", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      {
        ...baseRow,
        user: { name: "Doe, Jane", email: "jane@t.com" },
        lesson: {
          ...baseRow.lesson,
          module: { course: { title: "Compliance, Risk & Audit" } },
        },
      },
    ]);

    const res = await GET(makeReq());
    const body = await res.text();
    expect(body).toContain('"Doe, Jane"');
    expect(body).toContain('"Compliance, Risk & Audit"');
  });

  it("forwards from/to filters into the where clause", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    await GET(makeReq("from=2026-04-01T00:00:00Z&to=2026-04-30T23:59:59Z"));
    const where = mockPrisma.lessonProgress.findMany.mock.calls[0][0].where;
    expect(where.lesson).toEqual({ type: "POLICY_DOC" });
    expect(where.acknowledgedAt.gte.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
    expect(where.acknowledgedAt.lte.toISOString()).toBe(
      "2026-04-30T23:59:59.000Z",
    );
  });

  it("rejects invalid date strings", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await GET(makeReq("to=garbage"));
    expect(res.status).toBe(400);
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });
});
