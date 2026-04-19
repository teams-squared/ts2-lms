import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSendDeadlineReminderEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendDeadlineReminderEmail: (...args: unknown[]) =>
    mockSendDeadlineReminderEmail(...args),
}));

const CRON_SECRET = "dry-run-secret";

// Enrollment fixture with a lesson due today (10 days enrolled, 10 deadlineDays)
function makeDueTodayEnrollment() {
  const enrolledAt = new Date();
  enrolledAt.setUTCDate(enrolledAt.getUTCDate() - 10);
  enrolledAt.setUTCHours(0, 0, 0, 0);

  return {
    userId: "user-1",
    enrolledAt,
    user: { email: "user@test.com", name: "Test User" },
    course: {
      id: "course-1",
      title: "Test Course",
      modules: [
        {
          lessons: [
            { id: "lesson-1", title: "Lesson 1", deadlineDays: 10 },
          ],
        },
      ],
    },
  };
}

function makeRequest(dryRun: boolean) {
  const qs = dryRun ? "?dryRun=1" : "";
  return new Request(`http://localhost/api/cron/deadline-reminders${qs}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

async function importGET() {
  const mod = await import("@/app/api/cron/deadline-reminders/route");
  return mod.GET;
}

describe("GET /api/cron/deadline-reminders — dry run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeDueTodayEnrollment()])
      .mockResolvedValue([]); // second page: empty
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
  });

  it("dryRun=1 does NOT call sendDeadlineReminderEmail", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest(true));
    expect(res.status).toBe(200);
    expect(mockSendDeadlineReminderEmail).not.toHaveBeenCalled();
  });

  it("dryRun=1 does NOT write to DeadlineReminderLog", async () => {
    const GET = await importGET();
    await GET(makeRequest(true));
    expect(mockPrisma.deadlineReminderLog.create).not.toHaveBeenCalled();
  });

  it("dryRun=1 returns candidates in response with dryRun:true", async () => {
    const GET = await importGET();
    const res = await GET(makeRequest(true));
    const body = await res.json();

    expect(body.dryRun).toBe(true);
    expect(typeof body.sent).toBe("number");
    expect(Array.isArray(body.sample)).toBe(true);
  });

  it("without dryRun param, calls email send for a candidate", async () => {
    // Reset mocks for non-dry-run scenario
    mockPrisma.enrollment.findMany
      .mockReset()
      .mockResolvedValueOnce([makeDueTodayEnrollment()])
      .mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.create.mockResolvedValue({});

    const GET = await importGET();
    const res = await GET(makeRequest(false));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.dryRun).toBe(false);
    expect(mockSendDeadlineReminderEmail).toHaveBeenCalled();
    expect(mockPrisma.deadlineReminderLog.create).toHaveBeenCalled();
  });
});
