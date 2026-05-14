import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkCourseEligibilityBatch } = await import(
  "@/lib/course-eligibility"
);

beforeEach(() => {
  // Use resetAllMocks (not clearAllMocks) so queued mockResolvedValueOnce
  // values from a prior test don't leak into the next. resetAllMocks clears
  // BOTH state and the implementation queue.
  vi.resetAllMocks();
});

describe("checkCourseEligibilityBatch", () => {
  it("returns an empty map when no course ids are provided", async () => {
    const result = await checkCourseEligibilityBatch("u1", "employee", []);
    expect(result.size).toBe(0);
    expect(mockPrisma.course.findMany).not.toHaveBeenCalled();
  });

  it("short-circuits for admin (every id marked eligible, no DB call)", async () => {
    const result = await checkCourseEligibilityBatch("u1", "admin", [
      "c-a",
      "c-b",
      "c-c",
    ]);
    expect(result.size).toBe(3);
    expect(result.get("c-a")?.eligible).toBe(true);
    expect(mockPrisma.course.findMany).not.toHaveBeenCalled();
  });

  it("marks unknown course ids as ineligible without prereq/clearance fields", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", [
      "c-missing",
    ]);

    const entry = result.get("c-missing");
    expect(entry?.eligible).toBe(false);
    expect(entry?.missingPrerequisites).toEqual([]);
    expect(entry?.missingClearance).toBeNull();
  });

  it("flags missing clearance and not the prereq when only clearance is unmet", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        requiredClearance: "SECRET",
        prerequisites: [],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([
      { clearance: "PUBLIC" },
    ]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    expect(result.get("c-1")).toEqual({
      eligible: false,
      missingClearance: "SECRET",
      missingPrerequisites: [],
    });
  });

  it("flags eligible when user holds the required clearance", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      { id: "c-1", requiredClearance: "SECRET", prerequisites: [] },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([
      { clearance: "SECRET" },
    ]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);
    expect(result.get("c-1")?.eligible).toBe(true);
  });

  it("flags an empty prerequisite course as not-completed (defensive)", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        requiredClearance: null,
        prerequisites: [
          { prerequisite: { id: "pre-empty", title: "Empty pre" } },
        ],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
    // No lessons exist for the prereq course — treat as not completed.
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    const entry = result.get("c-1");
    expect(entry?.eligible).toBe(false);
    expect(entry?.missingPrerequisites).toEqual([
      { id: "pre-empty", title: "Empty pre" },
    ]);
  });

  it("marks prereq incomplete when not every lesson has been completed", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        requiredClearance: null,
        prerequisites: [{ prerequisite: { id: "pre-A", title: "Pre A" } }],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([
      { id: "l-1", module: { courseId: "pre-A" } },
      { id: "l-2", module: { courseId: "pre-A" } },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([
      { lessonId: "l-1" },
      // l-2 NOT completed
    ]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    expect(result.get("c-1")?.missingPrerequisites).toEqual([
      { id: "pre-A", title: "Pre A" },
    ]);
  });

  it("marks prereq complete when all its lessons have been completed", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        requiredClearance: null,
        prerequisites: [{ prerequisite: { id: "pre-A", title: "Pre A" } }],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([
      { id: "l-1", module: { courseId: "pre-A" } },
      { id: "l-2", module: { courseId: "pre-A" } },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([
      { lessonId: "l-1" },
      { lessonId: "l-2" },
    ]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);
    expect(result.get("c-1")?.eligible).toBe(true);
  });

  it("dedupes prerequisite course ids across the batch", async () => {
    // Two courses share the same prerequisite — should only fetch its lessons once.
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        requiredClearance: null,
        prerequisites: [{ prerequisite: { id: "pre-shared", title: "Shared" } }],
      },
      {
        id: "c-2",
        requiredClearance: null,
        prerequisites: [{ prerequisite: { id: "pre-shared", title: "Shared" } }],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([
      { id: "l-1", module: { courseId: "pre-shared" } },
    ]);
    mockPrisma.lessonProgress.findMany.mockResolvedValueOnce([
      { lessonId: "l-1" },
    ]);

    const result = await checkCourseEligibilityBatch("u1", "employee", [
      "c-1",
      "c-2",
    ]);

    expect(result.get("c-1")?.eligible).toBe(true);
    expect(result.get("c-2")?.eligible).toBe(true);
    // lesson.findMany should be invoked once with the deduped list.
    const lessonArgs = mockPrisma.lesson.findMany.mock.calls[0][0];
    expect(lessonArgs.where.module.courseId.in).toEqual(["pre-shared"]);
  });

  it("skips lesson and progress queries when no course has prerequisites", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      { id: "c-1", requiredClearance: null, prerequisites: [] },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);

    await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    // No prereq course IDs → the `prereqCourseIds.length > 0` branch falls to
    // the empty-Promise fallback, so lesson.findMany should not be called.
    expect(mockPrisma.lesson.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });
});
