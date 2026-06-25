import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockAwardXp = vi.fn().mockResolvedValue({ newAchievements: [] });
vi.mock("@/lib/xp", () => ({ awardXp: (...a: unknown[]) => mockAwardXp(...a) }));

const mockTrackEvent = vi.fn();
vi.mock("@/lib/posthog-server", () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));

vi.mock("@/lib/email", () => ({ sendCourseCompletionEmail: vi.fn() }));

const { maybeCompleteModule, MODULE_COMPLETION_XP } = await import(
  "@/lib/enrollments"
);

const NOW = new Date("2026-06-25T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maybeCompleteModule", () => {
  it("does nothing when the module has no lessons", async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([]);

    const res = await maybeCompleteModule("u1", "modA", NOW);
    expect(res.moduleComplete).toBe(false);
    expect(mockPrisma.moduleCompletion.create).not.toHaveBeenCalled();
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it("does not stamp when some lessons are still incomplete", async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([{ id: "L1" }, { id: "L2" }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1); // 1 of 2 done

    const res = await maybeCompleteModule("u1", "modA", NOW);
    expect(res.moduleComplete).toBe(false);
    expect(mockPrisma.moduleCompletion.create).not.toHaveBeenCalled();
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it("stamps + awards XP + fires event when all lessons are complete", async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([{ id: "L1" }, { id: "L2" }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(2); // all done
    mockPrisma.moduleCompletion.create.mockResolvedValue({});

    const res = await maybeCompleteModule("u1", "modA", NOW);
    expect(res.moduleComplete).toBe(true);
    expect(mockPrisma.moduleCompletion.create).toHaveBeenCalledWith({
      data: { userId: "u1", moduleId: "modA", completedAt: NOW },
    });
    expect(mockAwardXp).toHaveBeenCalledWith("u1", MODULE_COMPLETION_XP);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "u1",
      "module_completed",
      expect.objectContaining({ moduleId: "modA" }),
    );
  });

  it("is idempotent: a P2002 race loser does not double-award", async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([{ id: "L1" }]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
    mockPrisma.moduleCompletion.create.mockRejectedValue({ code: "P2002" });

    const res = await maybeCompleteModule("u1", "modA", NOW);
    expect(res.moduleComplete).toBe(false);
    expect(mockAwardXp).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
