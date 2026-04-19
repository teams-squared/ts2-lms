import { describe, it, expect } from "vitest";
import { computeDueReminders } from "@/lib/deadline-reminders";
import type { EnrollmentWithNested } from "@/lib/deadline-reminders";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a synthetic enrollment. `enrolledAt` + `deadlineDays` determines the deadline. */
function makeEnrollment(opts: {
  userId?: string;
  enrolledAt: Date;
  lessons: Array<{ deadlineDays: number; id?: string; title?: string }>;
  completedLessonIds?: string[];
}): EnrollmentWithNested {
  const userId = opts.userId ?? "user-1";
  return {
    userId,
    enrolledAt: opts.enrolledAt,
    user: { email: `${userId}@test.com`, name: `User ${userId}` },
    course: {
      id: "course-1",
      title: "Test Course",
      modules: [
        {
          lessons: opts.lessons.map((l, i) => ({
            id: l.id ?? `lesson-${i}`,
            title: l.title ?? `Lesson ${i}`,
            deadlineDays: l.deadlineDays,
          })),
        },
      ],
    },
    lessonProgressForUser: (opts.completedLessonIds ?? []).map((lessonId) => ({
      lessonId,
      completedAt: new Date("2026-01-01"),
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// "now" for all tests: 2026-04-19 00:00:00 UTC (midnight)
const NOW = new Date("2026-04-19T00:00:00Z");

describe("computeDueReminders", () => {
  it("emits due_soon_1 when daysUntil === 1 (deadline is tomorrow)", () => {
    // enrolledAt 10 days ago, deadlineDays=11 → deadline = Apr 20 (tomorrow)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 11 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("due_soon_1");
    expect(results[0].daysOffset).toBe(1);
  });

  it("emits due_today when daysUntil === 0 (deadline is today)", () => {
    // enrolledAt 10 days ago, deadlineDays=10 → deadline = Apr 19 (today)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 10 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("due_today");
    expect(results[0].daysOffset).toBe(0);
  });

  it("emits overdue_1 when daysUntil === -1 (deadline was yesterday)", () => {
    // enrolledAt 10 days ago, deadlineDays=9 → deadline = Apr 18 (yesterday)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 9 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("overdue_1");
    expect(results[0].daysOffset).toBe(-1);
  });

  it("does NOT emit for daysUntil === 2 (too far out)", () => {
    // deadline = Apr 21 (2 days away)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 12 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit for daysUntil === -2 (2 days overdue)", () => {
    // deadline = Apr 17 (2 days ago)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 8 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit for daysUntil === -5", () => {
    // deadline = Apr 14 (5 days ago)
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 5 }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(0);
  });

  it("skips completed lessons", () => {
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      enrolledAt,
      lessons: [{ deadlineDays: 10, id: "lesson-A" }],
      completedLessonIds: ["lesson-A"],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(0);
  });

  it("skips lessons with no deadlineDays", () => {
    // We manually add a lesson with null deadlineDays to the fixture
    const enrollment: EnrollmentWithNested = {
      userId: "user-1",
      enrolledAt: new Date("2026-04-09T00:00:00Z"),
      user: { email: "user-1@test.com", name: "User 1" },
      course: {
        id: "course-1",
        title: "Test Course",
        modules: [
          {
            lessons: [
              { id: "lesson-0", title: "Lesson 0", deadlineDays: null },
            ],
          },
        ],
      },
      lessonProgressForUser: [],
    };

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(0);
  });

  it("handles multiple enrollments and emits correct candidates", () => {
    const enrolledAt = new Date("2026-04-09T00:00:00Z");

    const e1 = makeEnrollment({
      userId: "user-1",
      enrolledAt,
      lessons: [
        { deadlineDays: 11, id: "l1" }, // due tomorrow → due_soon_1
        { deadlineDays: 10, id: "l2" }, // due today    → due_today
        { deadlineDays: 12, id: "l3" }, // 2 days away  → skip
      ],
    });
    const e2 = makeEnrollment({
      userId: "user-2",
      enrolledAt,
      lessons: [
        { deadlineDays: 9, id: "l4" }, // yesterday → overdue_1
        { deadlineDays: 9, id: "l5", title: "Completed" },
      ],
      completedLessonIds: ["l5"],
    });

    const results = computeDueReminders([e1, e2], NOW);
    expect(results).toHaveLength(3);

    const kinds = results.map((r) => r.kind);
    expect(kinds).toContain("due_soon_1");
    expect(kinds).toContain("due_today");
    expect(kinds).toContain("overdue_1");

    // l5 was completed, must not appear
    expect(results.find((r) => r.lessonId === "l5")).toBeUndefined();
  });

  it("result shape includes all required fields", () => {
    const enrolledAt = new Date("2026-04-09T00:00:00Z");
    const enrollment = makeEnrollment({
      userId: "user-x",
      enrolledAt,
      lessons: [{ deadlineDays: 10, id: "lesson-x", title: "My Lesson" }],
    });

    const results = computeDueReminders([enrollment], NOW);
    expect(results).toHaveLength(1);

    const r = results[0];
    expect(r.userId).toBe("user-x");
    expect(r.userEmail).toBe("user-x@test.com");
    expect(r.lessonId).toBe("lesson-x");
    expect(r.lessonTitle).toBe("My Lesson");
    expect(r.courseId).toBe("course-1");
    expect(r.courseTitle).toBe("Test Course");
    expect(r.kind).toBe("due_today");
    expect(r.daysOffset).toBe(0);
  });
});
