import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkCourseEligibilityBatch } = await import(
  "@/lib/course-eligibility"
);

// Clearance-requirement row shape as selected by the batch helper.
const req = (sectorId: string, tier: number, label = sectorId) => ({
  sectorId,
  tier,
  sector: { label },
});

beforeEach(() => {
  // resetAllMocks clears both state and queued mockResolvedValueOnce values.
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
    expect(entry?.clearanceLocked).toBe(false);
    expect(entry?.clearanceHint).toBeNull();
  });

  it("locks on clearance (and not prereq) when only clearance is unmet", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        clearanceRequirements: [req("cyber", 1, "Cybersecurity")],
        prerequisites: [],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([
      { sectorId: "cyber", tier: 3 }, // too high → locked
    ]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    expect(result.get("c-1")).toEqual({
      eligible: false,
      missingPrerequisites: [],
      clearanceLocked: true,
      clearanceHint: "Cybersecurity tier ≤1",
    });
  });

  it("eligible when user holds a sufficient tier", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        clearanceRequirements: [req("cyber", 2, "Cybersecurity")],
        prerequisites: [],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([
      { sectorId: "cyber", tier: 1 }, // 1 <= 2 → ok
    ]);
    mockPrisma.lesson.findMany.mockResolvedValueOnce([]);

    const result = await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);
    expect(result.get("c-1")?.eligible).toBe(true);
  });

  it("flags an empty prerequisite course as not-completed (defensive)", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        clearanceRequirements: [],
        prerequisites: [
          { prerequisite: { id: "pre-empty", title: "Empty pre" } },
        ],
      },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);
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
        clearanceRequirements: [],
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
        clearanceRequirements: [],
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
    mockPrisma.course.findMany.mockResolvedValueOnce([
      {
        id: "c-1",
        clearanceRequirements: [],
        prerequisites: [{ prerequisite: { id: "pre-shared", title: "Shared" } }],
      },
      {
        id: "c-2",
        clearanceRequirements: [],
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
    const lessonArgs = mockPrisma.lesson.findMany.mock.calls[0][0];
    expect(lessonArgs.where.module.courseId.in).toEqual(["pre-shared"]);
  });

  it("skips lesson and progress queries when no course has prerequisites", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([
      { id: "c-1", clearanceRequirements: [], prerequisites: [] },
    ]);
    mockPrisma.userClearance.findMany.mockResolvedValueOnce([]);

    await checkCourseEligibilityBatch("u1", "employee", ["c-1"]);

    expect(mockPrisma.lesson.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.lessonProgress.findMany).not.toHaveBeenCalled();
  });
});
