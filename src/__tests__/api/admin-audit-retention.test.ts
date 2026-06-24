import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, PATCH } = await import(
  "@/app/api/admin/settings/audit-retention/route"
);

const adminSession = () => mockSession({ id: "admin-id", role: "admin" });

function patchReq(body: unknown) {
  return new Request("http://localhost/api/admin/settings/audit-retention", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("audit-retention legal-hold settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET defaults to not-paused when no row exists", async () => {
    mockAuth.mockResolvedValue(adminSession());
    mockPrisma.auditRetentionSettings.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ prunePaused: false, pauseReason: null });
  });

  it("PATCH 403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await PATCH(patchReq({ prunePaused: true }));
    expect(res.status).toBe(403);
  });

  it("PATCH rejects an invalid body", async () => {
    mockAuth.mockResolvedValue(adminSession());
    const res = await PATCH(patchReq({ prunePaused: "yes" }));
    expect(res.status).toBe(400);
  });

  it("PATCH sets the hold with a reason and writes an audit entry", async () => {
    mockAuth.mockResolvedValue(adminSession());
    mockPrisma.auditRetentionSettings.upsert.mockResolvedValue({
      prunePaused: true,
      pauseReason: "ISO audit 2026-Q3",
      updatedAt: new Date("2026-06-24T00:00:00.000Z"),
      updatedBy: "admin-id",
    });

    const res = await PATCH(
      patchReq({ prunePaused: true, pauseReason: "ISO audit 2026-Q3" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      prunePaused: true,
      pauseReason: "ISO audit 2026-Q3",
    });

    // The toggle itself must be audited (self-evidencing control).
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "setting.updated",
          targetType: "setting",
          targetId: "audit_retention",
        }),
      }),
    );
  });

  it("PATCH clears the reason when resuming pruning", async () => {
    mockAuth.mockResolvedValue(adminSession());
    mockPrisma.auditRetentionSettings.upsert.mockResolvedValue({
      prunePaused: false,
      pauseReason: null,
      updatedAt: new Date(),
      updatedBy: "admin-id",
    });

    await PATCH(patchReq({ prunePaused: false, pauseReason: "stale note" }));

    const call = mockPrisma.auditRetentionSettings.upsert.mock.calls[0][0];
    expect(call.update.pauseReason).toBeNull();
    expect(call.create.pauseReason).toBeNull();
  });
});
