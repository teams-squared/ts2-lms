import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkCourseEligibility } = await import("@/lib/course-eligibility");

describe("checkCourseEligibility", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── 1. Admin bypasses all checks ──────────────────────────────────────
  it("returns eligible:true for admin without querying the database", async () => {
    const result = await checkCourseEligibility("u1", "admin", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      missingClearance: null,
    });
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
  });

  // ── 2. Course not found ───────────────────────────────────────────────
  it("returns eligible:false when the course does not exist", async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);

    const result = await checkCourseEligibility("u1", "employee", "missing");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [],
      missingClearance: null,
    });
  });

  // ── 3. No clearance, no prerequisites ─────────────────────────────────
  it("returns eligible:true when course has no clearance and no prerequisites", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: null,
      prerequisites: [],
    });

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      missingClearance: null,
    });
  });

  // ── 4. Has required clearance and user possesses it ───────────────────
  it("returns eligible:true when user has the required clearance", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: "SECRET",
      prerequisites: [],
    });
    mockPrisma.userClearance.findUnique.mockResolvedValue({
      userId: "u1",
      clearance: "SECRET",
    });

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      missingClearance: null,
    });
  });

  // ── 5. Missing clearance ──────────────────────────────────────────────
  it("returns eligible:false with missingClearance when user lacks clearance", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: "TOP_SECRET",
      prerequisites: [],
    });
    mockPrisma.userClearance.findUnique.mockResolvedValue(null);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [],
      missingClearance: "TOP_SECRET",
    });
  });

  // ── 6. All prerequisites completed ────────────────────────────────────
  it("returns eligible:true when all prerequisite courses are completed", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: null,
      prerequisites: [
        { prerequisite: { id: "prereq-1", title: "Intro" } },
        { prerequisite: { id: "prereq-2", title: "Basics" } },
      ],
    });

    // prereq-1: 2 lessons, 2 completed
    mockPrisma.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }])
      // prereq-2: 1 lesson, 1 completed
      .mockResolvedValueOnce([{ id: "l3" }]);

    mockPrisma.lessonProgress.count
      .mockResolvedValueOnce(2) // matches prereq-1 lesson count
      .mockResolvedValueOnce(1); // matches prereq-2 lesson count

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      missingClearance: null,
    });
  });

  // ── 7. Missing prerequisites ──────────────────────────────────────────
  it("returns eligible:false with missingPrerequisites when prereqs incomplete", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: null,
      prerequisites: [
        { prerequisite: { id: "prereq-1", title: "Intro" } },
        { prerequisite: { id: "prereq-2", title: "Basics" } },
      ],
    });

    // prereq-1: 2 lessons, only 1 completed -> not completed
    mockPrisma.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }])
      // prereq-2: 1 lesson, 1 completed -> completed
      .mockResolvedValueOnce([{ id: "l3" }]);

    mockPrisma.lessonProgress.count
      .mockResolvedValueOnce(1) // only 1 of 2 for prereq-1
      .mockResolvedValueOnce(1); // 1 of 1 for prereq-2

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [{ id: "prereq-1", title: "Intro" }],
      missingClearance: null,
    });
  });

  // ── 8. Prereq with no lessons -> not completed ────────────────────────
  it("treats a prerequisite with no lessons as not completed", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: null,
      prerequisites: [
        { prerequisite: { id: "empty-course", title: "Empty Course" } },
      ],
    });

    mockPrisma.lesson.findMany.mockResolvedValueOnce([]); // no lessons

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [{ id: "empty-course", title: "Empty Course" }],
      missingClearance: null,
    });
    // lessonProgress.count should not be called when there are no lessons
    expect(mockPrisma.lessonProgress.count).not.toHaveBeenCalled();
  });

  // ── 9. Both clearance and prerequisites missing ───────────────────────
  it("populates both missingClearance and missingPrerequisites when both are missing", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      requiredClearance: "CLASSIFIED",
      prerequisites: [
        { prerequisite: { id: "prereq-1", title: "Security 101" } },
      ],
    });
    mockPrisma.userClearance.findUnique.mockResolvedValue(null);

    // prereq has 3 lessons, user completed 0
    mockPrisma.lesson.findMany.mockResolvedValueOnce([
      { id: "l1" },
      { id: "l2" },
      { id: "l3" },
    ]);
    mockPrisma.lessonProgress.count.mockResolvedValueOnce(0);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [{ id: "prereq-1", title: "Security 101" }],
      missingClearance: "CLASSIFIED",
    });
  });
});
