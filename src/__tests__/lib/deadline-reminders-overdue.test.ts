import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

import { getOverdueForUser } from "@/lib/deadline-reminders";

beforeEach(() => {
  vi.resetAllMocks();
});

/** Build an enrollment whose lessons are X days past their deadline today. */
function enrollment(opts: {
  courseId?: string;
  courseTitle?: string;
  enrolledDaysAgo: number;
  lessons: { id: string; title: string; deadlineDays: number }[];
}) {
  const enrolledAt = new Date(Date.now() - opts.enrolledDaysAgo * 86_400_000);
  return {
    enrolledAt,
    course: {
      id: opts.courseId ?? "course-1",
      title: opts.courseTitle ?? "Course",
      modules: [{ lessons: opts.lessons }],
    },
  };
}

describe("getOverdueForUser", () => {
  it("returns an empty list when the user has no enrollments", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");
    expect(result).toEqual([]);
  });

  it("ignores completed lessons even if they're past deadline", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        enrolledDaysAgo: 30,
        lessons: [{ id: "l-1", title: "Done", deadlineDays: 5 }],
      }),
    ]);
    // Completed → skipped
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([{ lessonId: "l-1" }]);

    const result = await getOverdueForUser("u-1");
    expect(result).toEqual([]);
  });

  it("ignores lessons without a deadline configured", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        enrolledDaysAgo: 30,
        lessons: [
          // deadlineDays:0 is falsy and treated as "no deadline" per source's `if (!lesson.deadlineDays)` guard.
          { id: "l-1", title: "No deadline", deadlineDays: 0 },
        ],
      }),
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");
    expect(result).toEqual([]);
  });

  it("ignores lessons whose deadline is still in the future", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        enrolledDaysAgo: 1,
        lessons: [{ id: "l-future", title: "Future", deadlineDays: 30 }],
      }),
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");
    expect(result).toEqual([]);
  });

  it("returns overdue lessons with daysOverdue clamped to >= 1", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        enrolledDaysAgo: 10, // enrolled 10 days ago
        lessons: [
          // deadline: 5d → 5 days overdue
          { id: "l-1", title: "Lesson A", deadlineDays: 5 },
        ],
      }),
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      lessonId: "l-1",
      lessonTitle: "Lesson A",
      courseId: "course-1",
    });
    expect(result[0].daysOverdue).toBeGreaterThanOrEqual(1);
  });

  it("sorts most-overdue lessons first", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        enrolledDaysAgo: 30,
        lessons: [
          // Deadline 1 day → ~29 days overdue
          { id: "l-old", title: "Old", deadlineDays: 1 },
          // Deadline 25 days → ~5 days overdue
          { id: "l-new", title: "New", deadlineDays: 25 },
        ],
      }),
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");

    expect(result.map((r) => r.lessonId)).toEqual(["l-old", "l-new"]);
    expect(result[0].daysOverdue).toBeGreaterThan(result[1].daysOverdue);
  });

  it("aggregates across multiple enrollments", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      enrollment({
        courseId: "course-A",
        courseTitle: "Course A",
        enrolledDaysAgo: 20,
        lessons: [{ id: "l-A", title: "A lesson", deadlineDays: 5 }],
      }),
      enrollment({
        courseId: "course-B",
        courseTitle: "Course B",
        enrolledDaysAgo: 10,
        lessons: [{ id: "l-B", title: "B lesson", deadlineDays: 5 }],
      }),
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([]);

    const result = await getOverdueForUser("u-1");

    expect(result.map((r) => r.courseId)).toEqual(["course-A", "course-B"]);
  });
});
