import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const CRON_SECRET = "test-cron-secret-abc";

function makeRequest(authHeader?: string, query = "") {
  return new Request(`http://localhost/api/cron/prune-audit-logs${query}`, {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

async function importGET() {
  const mod = await import("@/app/api/cron/prune-audit-logs/route");
  return mod.GET;
}

describe("GET /api/cron/prune-audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
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

  it("deletes rows older than the default 365-day window", async () => {
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 7 });
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ deleted: 7, retentionDays: 365 });

    // Cutoff must be ~365 days in the past.
    const call = mockPrisma.auditLog.deleteMany.mock.calls[0][0];
    const cutoff = call.where.createdAt.lt as Date;
    const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(364);
    expect(ageDays).toBeLessThan(366);
  });

  it("honours AUDIT_LOG_RETENTION_DAYS override", async () => {
    vi.stubEnv("AUDIT_LOG_RETENTION_DAYS", "30");
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();
    expect(body.retentionDays).toBe(30);
  });

  it("dryRun counts without deleting", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(42);
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`, "?dryRun=1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ dryRun: true, wouldDelete: 42, retentionDays: 365 });
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});
