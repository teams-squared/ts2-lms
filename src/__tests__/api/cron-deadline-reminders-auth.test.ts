import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email", () => ({
  sendDeadlineReminderEmail: vi.fn().mockResolvedValue(undefined),
}));

const CRON_SECRET = "test-cron-secret-abc";

function makeRequest(authHeader?: string) {
  return new Request("http://localhost/api/cron/deadline-reminders", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

async function importGET() {
  const mod = await import("@/app/api/cron/deadline-reminders/route");
  return mod.GET;
}

describe("GET /api/cron/deadline-reminders — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    // No enrollments so the route exits quickly
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header has wrong secret", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 when Authorization header is correct", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
  });

  it("returns 500 when CRON_SECRET env var is unset", async () => {
    vi.unstubAllEnvs();
    // Do NOT set CRON_SECRET
    const GET = await importGET();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("CRON_SECRET not configured");
  });
});
