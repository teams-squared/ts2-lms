import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSendDeadlineReminderEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendDeadlineReminderEmail: (...args: unknown[]) =>
    mockSendDeadlineReminderEmail(...args),
}));

const CRON_SECRET = "dedup-secret";

// Enrollment with a lesson due today
function makeEnrollment() {
  const enrolledAt = new Date();
  enrolledAt.setUTCDate(enrolledAt.getUTCDate() - 10);
  enrolledAt.setUTCHours(0, 0, 0, 0);
  return {
    userId: "user-1",
    enrolledAt,
    user: { email: "user@test.com", name: "User One" },
    course: {
      id: "course-1",
      title: "Course",
      modules: [
        {
          lessons: [{ id: "lesson-1", title: "Lesson 1", deadlineDays: 10 }],
        },
      ],
    },
  };
}

function makeRequest() {
  return new Request("http://localhost/api/cron/deadline-reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

async function importGET() {
  const mod = await import("@/app/api/cron/deadline-reminders/route");
  return mod.GET;
}

describe("GET /api/cron/deadline-reminders — dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  it("skips candidate when existing log row found (already logged)", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollment()])
      .mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    // Simulate an already-sent log row
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([
      { userId: "user-1", lessonId: "lesson-1", kind: "due_today" },
    ]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.skippedAlreadyLogged).toBe(1);
    expect(body.sent).toBe(0);
    expect(mockSendDeadlineReminderEmail).not.toHaveBeenCalled();
    expect(mockPrisma.deadlineReminderLog.create).not.toHaveBeenCalled();
  });

  it("sends and logs when no existing log row found", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollment()])
      .mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]); // no prior logs
    mockPrisma.deadlineReminderLog.create.mockResolvedValue({});

    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.skippedAlreadyLogged).toBe(0);
    expect(mockSendDeadlineReminderEmail).toHaveBeenCalledOnce();
    expect(mockPrisma.deadlineReminderLog.create).toHaveBeenCalledOnce();
  });

  it("treats unique-constraint error from concurrent run as skip, not error", async () => {
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce([makeEnrollment()])
      .mockResolvedValue([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.create.mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors).toBe(0);
    expect(body.skippedAlreadyLogged).toBe(1);
  });
});
