import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSendDeadlineReminderEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendDeadlineReminderEmail: (...args: unknown[]) =>
    mockSendDeadlineReminderEmail(...args),
}));

const CRON_SECRET = "threshold-secret";

/**
 * Build an enrollment whose lesson deadline lands `daysFromNow` days
 * relative to the faked "now". Positive = future, negative = past.
 *
 * Strategy: enrolledAt = midnight UTC on (now - 100 days),
 * deadlineDays = 100 + daysFromNow  →  deadline = now + daysFromNow days
 */
function makeEnrollmentWithOffset(daysFromNow: number, lessonId: string) {
  const now = new Date();
  const enrolledAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 100),
  );
  return {
    userId: `user-${lessonId}`,
    enrolledAt,
    user: { email: `user-${lessonId}@test.com`, name: `User ${lessonId}` },
    course: {
      id: "course-1",
      title: "Course",
      modules: [
        {
          lessons: [
            {
              id: lessonId,
              title: `Lesson ${lessonId}`,
              deadlineDays: 100 + daysFromNow,
            },
          ],
        },
      ],
    },
  };
}

function makeRequest() {
  return new Request("http://localhost/api/cron/deadline-reminders?dryRun=1", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

async function importGET() {
  const mod = await import("@/app/api/cron/deadline-reminders/route");
  return mod.GET;
}

describe("GET /api/cron/deadline-reminders — threshold checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.useFakeTimers();
    // Pin "now" to a fixed UTC midnight
    vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));

    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits due_soon_1 for daysFromNow=1", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollmentWithOffset(1, "l1")])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.sample[0].kind).toBe("due_soon_1");
  });

  it("emits due_today for daysFromNow=0", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollmentWithOffset(0, "l2")])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.sample[0].kind).toBe("due_today");
  });

  it("emits overdue_1 for daysFromNow=-1", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollmentWithOffset(-1, "l3")])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.sample[0].kind).toBe("overdue_1");
  });

  it("does NOT emit for daysFromNow=2", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollmentWithOffset(2, "l4")])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(0);
  });

  it("does NOT emit for daysFromNow=-5", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollmentWithOffset(-5, "l5")])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(0);
  });

  it("only emits 1/0/-1, not 2/-2 in a mixed batch", async () => {
    // Five enrollments with offsets: 1, 0, -1, 2, -2
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([
        makeEnrollmentWithOffset(1, "la"),
        makeEnrollmentWithOffset(0, "lb"),
        makeEnrollmentWithOffset(-1, "lc"),
        makeEnrollmentWithOffset(2, "ld"),
        makeEnrollmentWithOffset(-2, "le"),
      ])
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sent).toBe(3);
    const kinds = body.sample.map((s: { kind: string }) => s.kind);
    expect(kinds).toContain("due_soon_1");
    expect(kinds).toContain("due_today");
    expect(kinds).toContain("overdue_1");
  });
});
