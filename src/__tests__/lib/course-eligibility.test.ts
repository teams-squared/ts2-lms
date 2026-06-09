import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkCourseEligibility } = await import("@/lib/course-eligibility");

// Build a clearance-requirement row as selected by course-eligibility.
const req = (sectorId: string, tier: number, label = sectorId) => ({
  sectorId,
  tier,
  sector: { label },
});

describe("checkCourseEligibility", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── 1. Admin bypasses all checks ──────────────────────────────────────
  it("returns eligible:true for admin without querying the database", async () => {
    const result = await checkCourseEligibility("u1", "admin", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      clearanceLocked: false,
      clearanceHint: null,
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
      clearanceLocked: false,
      clearanceHint: null,
    });
  });

  // ── 3. No clearance, no prerequisites ─────────────────────────────────
  it("returns eligible:true when course has no requirements and no prerequisites", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [],
      prerequisites: [],
    });

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      clearanceLocked: false,
      clearanceHint: null,
    });
    // No requirements → don't bother loading tiers.
    expect(mockPrisma.userClearance.findMany).not.toHaveBeenCalled();
  });

  // ── 4. User holds a sufficient tier (lower = more access) ─────────────
  it("returns eligible:true when user tier <= required tier", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [req("cyber", 3, "Cybersecurity")],
      prerequisites: [],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([
      { sectorId: "cyber", tier: 1 },
    ]);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result.eligible).toBe(true);
    expect(result.clearanceLocked).toBe(false);
  });

  // ── 5. User tier too high (less privileged) ───────────────────────────
  it("locks when user tier > required tier", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [req("cyber", 1, "Cybersecurity")],
      prerequisites: [],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([
      { sectorId: "cyber", tier: 3 },
    ]);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result.eligible).toBe(false);
    expect(result.clearanceLocked).toBe(true);
    expect(result.clearanceHint).toBe("Cybersecurity tier ≤1");
  });

  // ── 6. Missing clearance entirely ─────────────────────────────────────
  it("locks when user holds no grant in the required sector", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [req("finance", 2, "Finance")],
      prerequisites: [],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([]);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result.eligible).toBe(false);
    expect(result.clearanceLocked).toBe(true);
    expect(result.clearanceHint).toBe("Finance tier ≤2");
  });

  // ── 7. ANY-satisfies across multiple requirements ─────────────────────
  it("unlocks when user satisfies ANY one of several requirements", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [
        req("cyber", 0, "Cybersecurity"),
        req("finance", 2, "Finance"),
      ],
      prerequisites: [],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([
      { sectorId: "cyber", tier: 2 }, // fails cyber tier 0
      { sectorId: "finance", tier: 1 }, // meets finance tier 2
    ]);

    const result = await checkCourseEligibility("u1", "employee", "c1");
    expect(result.eligible).toBe(true);
    expect(result.clearanceLocked).toBe(false);
  });

  // ── 8. All prerequisites completed ────────────────────────────────────
  it("returns eligible:true when all prerequisite courses are completed", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [],
      prerequisites: [
        { prerequisite: { id: "prereq-1", title: "Intro" } },
        { prerequisite: { id: "prereq-2", title: "Basics" } },
      ],
    });

    mockPrisma.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }])
      .mockResolvedValueOnce([{ id: "l3" }]);

    mockPrisma.lessonProgress.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: true,
      missingPrerequisites: [],
      clearanceLocked: false,
      clearanceHint: null,
    });
  });

  // ── 9. Missing prerequisites ──────────────────────────────────────────
  it("returns eligible:false with missingPrerequisites when prereqs incomplete", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [],
      prerequisites: [
        { prerequisite: { id: "prereq-1", title: "Intro" } },
        { prerequisite: { id: "prereq-2", title: "Basics" } },
      ],
    });

    mockPrisma.lesson.findMany
      .mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }])
      .mockResolvedValueOnce([{ id: "l3" }]);

    mockPrisma.lessonProgress.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await checkCourseEligibility("u1", "employee", "c1");

    expect(result).toEqual({
      eligible: false,
      missingPrerequisites: [{ id: "prereq-1", title: "Intro" }],
      clearanceLocked: false,
      clearanceHint: null,
    });
  });

  // ── 10. Both clearance and prerequisites missing ──────────────────────
  it("populates both clearanceLocked and missingPrerequisites when both fail", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      clearanceRequirements: [req("cyber", 0, "Cybersecurity")],
      prerequisites: [{ prerequisite: { id: "prereq-1", title: "Security 101" } }],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([]); // no grants

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
      clearanceLocked: true,
      clearanceHint: "Cybersecurity tier ≤0",
    });
  });
});
