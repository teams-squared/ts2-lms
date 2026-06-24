import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockListEnabledTenantEmails = vi.fn();
vi.mock("@/lib/entra/graph", () => ({
  listEnabledTenantEmails: (...args: unknown[]) =>
    mockListEnabledTenantEmails(...args),
}));

const mockWriteAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const CRON_SECRET = "test-cron-secret-abc";

function makeRequest(authHeader?: string, query = "") {
  return new Request(
    `http://localhost/api/cron/entra-offboard-sync${query}`,
    { headers: authHeader ? { authorization: authHeader } : {} },
  );
}

async function importGET() {
  const mod = await import("@/app/api/cron/entra-offboard-sync/route");
  return mod.GET;
}

/** $transaction passes a tx client to the callback — mirror prisma surface. */
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

describe("GET /api/cron/entra-offboard-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockListEnabledTenantEmails).not.toHaveBeenCalled();
  });

  it("returns 401 on wrong secret", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest("Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET unset", async () => {
    vi.unstubAllEnvs();
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(500);
  });

  it("fails closed — offboards nobody when Graph returns null", async () => {
    mockListEnabledTenantEmails.mockResolvedValue(null);
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: "graph_unavailable" });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("sanity guard — skips when enabled set is < 50% of active users", async () => {
    // 10 active users but Graph only returned 4 enabled — likely truncated.
    mockListEnabledTenantEmails.mockResolvedValue(
      new Set(["a@t.com", "b@t.com", "c@t.com", "d@t.com"]),
    );
    mockPrisma.user.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `u${i}`, email: `u${i}@t.com` })),
    );
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      skipped: "enabled_set_too_small",
      enabledCount: 4,
      activeCount: 10,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("dryRun reports candidates without writing", async () => {
    mockListEnabledTenantEmails.mockResolvedValue(
      new Set(["keep@t.com", "stay@t.com"]),
    );
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "keep@t.com" },
      { id: "u2", email: "gone@t.com" }, // not in enabled set → candidate
    ]);
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`, "?dryRun=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      dryRun: true,
      scanned: 2,
      wouldOffboard: ["gone@t.com"],
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("offboards users absent from Entra (case-insensitive match)", async () => {
    mockListEnabledTenantEmails.mockResolvedValue(
      new Set(["keep@t.com", "stay@t.com"]),
    );
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "KEEP@t.com" }, // case-insensitive → stays active
      { id: "u2", email: "gone@t.com" }, // missing → offboarded
    ]);
    const tx = wireTransaction();

    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.offboarded).toEqual(["gone@t.com"]);

    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u2" } }),
    );
    // audit row written with system actor + entra-sync source
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.offboarded",
        actorId: null,
        targetId: "u2",
        metadata: expect.objectContaining({ source: "entra-sync" }),
      }),
      tx,
    );
  });

  it("offboards no one when all active users are still enabled", async () => {
    mockListEnabledTenantEmails.mockResolvedValue(
      new Set(["a@t.com", "b@t.com"]),
    );
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@t.com" },
      { id: "u2", email: "b@t.com" },
    ]);
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();
    expect(body.offboarded).toEqual([]);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
