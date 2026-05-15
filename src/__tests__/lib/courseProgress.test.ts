import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockListManagedCourseIds = vi.fn();
vi.mock("@/lib/courseAccess", () => ({
  listManagedCourseIds: (...args: unknown[]) => mockListManagedCourseIds(...args),
}));

const { loadCourseProgress } = await import("@/lib/courseProgress");

const NOW = new Date("2026-05-14T00:00:00Z");

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
});

describe("loadCourseProgress — role gating", () => {
  it("returns null for employee", async () => {
    const result = await loadCourseProgress("u1", "employee");
    expect(result).toBeNull();
    expect(mockPrisma.course.findMany).not.toHaveBeenCalled();
  });

  it("returns null for unknown role", async () => {
    // @ts-expect-error testing runtime guard
    const result = await loadCourseProgress("u1", "guest");
    expect(result).toBeNull();
  });

  it("admin: no managed-id filter applied (where = {})", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([]);
    await loadCourseProgress("admin1", "admin");
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("course_manager: where filtered to managed ids", async () => {
    mockListManagedCourseIds.mockResolvedValue(["c1", "c2"]);
    mockPrisma.course.findMany.mockResolvedValue([]);
    await loadCourseProgress("cm1", "course_manager");
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["c1", "c2"] } } }),
    );
  });
});

describe("loadCourseProgress — percent + overdue math", () => {
  it("0% for not-started learner with lessons", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course One",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Lesson 1", deadlineDays: null },
              { id: "L2", title: "Lesson 2", deadlineDays: null },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(1),
            completedAt: null,
            user: {
              id: "u1",
              name: "Akil",
              email: "akil@t.com",
              avatar: null,
            },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result).not.toBeNull();
    const seg = result![0];
    expect(seg.rows[0].percent).toBe(0);
    expect(seg.rows[0].completedLessons).toBe(0);
    expect(seg.rows[0].totalLessons).toBe(2);
    expect(seg.rows[0].enrollmentCompleted).toBe(false);
    expect(seg.rows[0].overdueLessons).toEqual([]);
  });

  it("50% partial: one of two lessons completed", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course One",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Lesson 1", deadlineDays: null },
              { id: "L2", title: "Lesson 2", deadlineDays: null },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(2),
            completedAt: null,
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { userId: "u1", lessonId: "L1" },
    ]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].percent).toBe(50);
    expect(result![0].rows[0].completedLessons).toBe(1);
  });

  it("Completed enrollment forced to 100% even if some lessonProgress rows missing", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course One",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Lesson 1", deadlineDays: null },
              { id: "L2", title: "Lesson 2", deadlineDays: null },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(5),
            completedAt: daysAgo(1),
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].percent).toBe(100);
    expect(result![0].rows[0].enrollmentCompleted).toBe(true);
    expect(result![0].completedCount).toBe(1);
  });

  it("0% when course has no lessons (avoids divide-by-zero)", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Empty",
        modules: [],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(1),
            completedAt: null,
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].percent).toBe(0);
    expect(result![0].totalLessons).toBe(0);
  });

  it("overdue: incomplete lesson past computeDeadline gets listed", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course One",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Late Lesson", deadlineDays: 1 },
              { id: "L2", title: "Future Lesson", deadlineDays: 30 },
              { id: "L3", title: "No deadline", deadlineDays: null },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(10),
            completedAt: null,
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].overdueLessons).toEqual(["Late Lesson"]);
    expect(result![0].overdueCount).toBe(1);
  });

  it("completed lessons never count as overdue", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Late but done", deadlineDays: 1 },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(10),
            completedAt: null,
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { userId: "u1", lessonId: "L1" },
    ]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].overdueLessons).toEqual([]);
  });

  it("course-completed enrollment suppresses overdue list entirely", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course",
        modules: [
          { lessons: [{ id: "L1", title: "L1", deadlineDays: 1 }] },
        ],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: daysAgo(10),
            completedAt: daysAgo(1),
            user: { id: "u1", name: "Akil", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].overdueLessons).toEqual([]);
  });

  it("sorts rows: most overdue first, then lowest percent", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course",
        modules: [
          {
            lessons: [
              { id: "L1", title: "L1", deadlineDays: 1 },
              { id: "L2", title: "L2", deadlineDays: 1 },
            ],
          },
        ],
        enrollments: [
          {
            userId: "u-low-percent-no-overdue",
            enrolledAt: NOW,
            completedAt: null,
            user: { id: "ua", name: "A", email: "a@t.com", avatar: null },
          },
          {
            userId: "u-two-overdue",
            enrolledAt: daysAgo(10),
            completedAt: null,
            user: { id: "ub", name: "B", email: "b@t.com", avatar: null },
          },
          {
            userId: "u-one-overdue",
            enrolledAt: daysAgo(10),
            completedAt: null,
            user: { id: "uc", name: "C", email: "c@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { userId: "u-one-overdue", lessonId: "L1" },
    ]);

    const result = await loadCourseProgress("admin1", "admin");
    const order = result![0].rows.map((r) => r.userId);
    expect(order).toEqual([
      "u-two-overdue",
      "u-one-overdue",
      "u-low-percent-no-overdue",
    ]);
  });

  it("falls back to 'Unnamed' when user.name is blank", async () => {
    mockListManagedCourseIds.mockResolvedValue(null);
    mockPrisma.course.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Course",
        modules: [],
        enrollments: [
          {
            userId: "u1",
            enrolledAt: NOW,
            completedAt: null,
            user: { id: "u1", name: "", email: "a@t.com", avatar: null },
          },
        ],
      },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const result = await loadCourseProgress("admin1", "admin");
    expect(result![0].rows[0].name).toBe("Unnamed");
  });
});
