import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET, PATCH } = await import(
  "@/app/api/admin/settings/iso-notifications/route"
);

describe("GET /api/admin/settings/iso-notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
  });

  it("returns empty arrays when settings row does not yet exist", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      toEmails: [],
      ccEmails: [],
      updatedAt: null,
      updatedBy: null,
    });
  });

  it("returns the persisted lists", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const updatedAt = new Date("2026-04-23T10:00:00Z");
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: ["officer@t.com"],
      ccEmails: ["owner@t.com"],
      updatedAt,
      updatedBy: "a1",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toEmails).toEqual(["officer@t.com"]);
    expect(body.ccEmails).toEqual(["owner@t.com"]);
    expect(body.updatedBy).toBe("a1");
  });
});

const makePatch = (payload: unknown) =>
  new Request("http://localhost/api/admin/settings/iso-notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

describe("PATCH /api/admin/settings/iso-notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await PATCH(makePatch({ toEmails: [], ccEmails: [] }));
    expect(res.status).toBe(403);
    expect(mockPrisma.isoNotificationSettings.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid email addresses", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await PATCH(
      makePatch({ toEmails: ["not-an-email"], ccEmails: [] }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.isoNotificationSettings.upsert).not.toHaveBeenCalled();
  });

  it("upserts the singleton row, lower-casing and dedupping recipients", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.isoNotificationSettings.upsert.mockResolvedValue({
      id: "singleton",
      toEmails: ["officer@t.com", "owner@t.com"],
      ccEmails: ["audit@t.com"],
      updatedAt: new Date(),
      updatedBy: "a1",
    });
    const res = await PATCH(
      makePatch({
        toEmails: ["Officer@T.com", "officer@t.com", "owner@t.com"],
        ccEmails: [" Audit@T.com "],
      }),
    );
    expect(res.status).toBe(200);
    const args = mockPrisma.isoNotificationSettings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ id: "singleton" });
    expect(args.create.toEmails).toEqual(["officer@t.com", "owner@t.com"]);
    expect(args.create.ccEmails).toEqual(["audit@t.com"]);
    expect(args.update.toEmails).toEqual(["officer@t.com", "owner@t.com"]);
    expect(args.update.updatedBy).toBe("a1");
  });

  it("accepts empty arrays (feature-off)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.isoNotificationSettings.upsert.mockResolvedValue({
      id: "singleton",
      toEmails: [],
      ccEmails: [],
      updatedAt: new Date(),
      updatedBy: "a1",
    });
    const res = await PATCH(makePatch({ toEmails: [], ccEmails: [] }));
    expect(res.status).toBe(200);
    expect(mockPrisma.isoNotificationSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed JSON", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const req = new Request(
      "http://localhost/api/admin/settings/iso-notifications",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
    );
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
