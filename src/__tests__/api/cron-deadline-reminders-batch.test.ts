import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSendDeadlineReminderEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendDeadlineReminderEmail: (...args: unknown[]) =>
    mockSendDeadlineReminderEmail(...args),
}));

const CRON_SECRET = "batch-secret";
const PAGE_SIZE = 200;

/** Build N synthetic enrollments each with one lesson due today. */
function makeEnrollments(count: number) {
  const enrolledAt = new Date();
  enrolledAt.setUTCDate(enrolledAt.getUTCDate() - 10);
  enrolledAt.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i}`,
    enrolledAt,
    user: { email: `user${i}@test.com`, name: `User ${i}` },
    course: {
      id: `course-${i}`,
      title: `Course ${i}`,
      modules: [
        {
          lessons: [
            { id: `lesson-${i}`, title: `Lesson ${i}`, deadlineDays: 10 },
          ],
        },
      ],
    },
  }));
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

describe("GET /api/cron/deadline-reminders — batch processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.findMany.mockResolvedValue([]);
    mockPrisma.deadlineReminderLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes 600 rows across multiple pages with truncated:false", async () => {
    // Use 3 full pages of PAGE_SIZE so the loop only terminates on the empty 4th page
    const total = PAGE_SIZE * 3; // 600
    const page1 = makeEnrollments(PAGE_SIZE);
    const page2 = makeEnrollments(PAGE_SIZE);
    const page3 = makeEnrollments(PAGE_SIZE);
    // Update user IDs to be unique across pages
    page2.forEach((e, i) => { e.userId = `user-p2-${i}`; });
    page3.forEach((e, i) => { e.userId = `user-p3-${i}`; });

    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(page3)
      .mockResolvedValue([]); // final empty page terminates loop

    const GET = await importGET();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.truncated).toBe(false);
    expect(body.sent).toBe(total);
    expect(mockPrisma.enrollment.findMany).toHaveBeenCalledTimes(4); // 3 pages + 1 empty
  });

  it("sets truncated:true when wall-clock budget is exceeded", async () => {
    vi.useFakeTimers();

    // Inject a slow send: advance time beyond budget on each call
    const BUDGET_MS = 50_000;
    let callCount = 0;
    mockSendDeadlineReminderEmail.mockImplementation(async () => {
      callCount++;
      // After 2 sends, exceed the budget
      if (callCount >= 2) {
        vi.advanceTimersByTime(BUDGET_MS + 1000);
      }
    });

    const enrollments = makeEnrollments(10);
    mockPrisma.enrollment.findMany
      .mockResolvedValueOnce(enrollments)
      .mockResolvedValue([]);

    const GET = await importGET();
    const res = await GET(makeRequest());
    const body = await res.json();

    // Should have stopped early due to budget
    expect(body.truncated).toBe(true);
    // Should have sent at least 1 (before cutoff) and fewer than all 10
    expect(body.sent).toBeGreaterThanOrEqual(1);
    expect(body.sent).toBeLessThan(10);
  });
});
