import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { checkAndAwardAchievements } = await import("@/lib/achievements");

// ── Helpers ─────────────────────────────────────────────────────────────
function makeAchievement(overrides: Partial<{
  id: string; key: string; title: string; description: string;
  icon: string; xpReward: number; category: string; threshold: number;
}> = {}) {
  return {
    id: overrides.id ?? "ach-1",
    key: overrides.key ?? "test_key",
    title: overrides.title ?? "Test Achievement",
    description: overrides.description ?? "desc",
    icon: overrides.icon ?? "trophy",
    xpReward: overrides.xpReward ?? 10,
    category: overrides.category ?? "lessons",
    threshold: overrides.threshold ?? 1,
  };
}

/** Set up default mocks that return empty/zero values. */
function setupDefaults() {
  mockPrisma.achievement.findMany.mockResolvedValue([]);
  mockPrisma.userAchievement.findMany.mockResolvedValue([]);
  mockPrisma.userStats.findUnique.mockResolvedValue(null);
  mockPrisma.lessonProgress.count.mockResolvedValue(0);
  mockPrisma.quizAttempt.count.mockResolvedValue(0);
  mockPrisma.quizAttempt.findFirst.mockResolvedValue(null);
  mockPrisma.enrollment.count.mockResolvedValue(0);
  mockPrisma.enrollment.findMany.mockResolvedValue([]);
  mockPrisma.module.findMany.mockResolvedValue([]);
  mockPrisma.userAchievement.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.userStats.update.mockResolvedValue({});
}

describe("checkAndAwardAchievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ── 1. No achievements defined ──────────────────────────────────────
  it("returns an empty array when no achievements exist", async () => {
    const result = await checkAndAwardAchievements("u1");
    expect(result).toEqual([]);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });

  // ── 2. All already earned ───────────────────────────────────────────
  it("returns an empty array when all achievements are already earned", async () => {
    const ach = makeAchievement({ id: "ach-1" });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userAchievement.findMany.mockResolvedValue([
      { achievementId: "ach-1" },
    ]);

    const result = await checkAndAwardAchievements("u1");
    expect(result).toEqual([]);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });

  // ── 3. Awards lessons achievement at threshold ──────────────────────
  it("awards a lessons achievement when lessonsCompleted meets threshold", async () => {
    const ach = makeAchievement({
      id: "ach-lessons",
      key: "lesson_5",
      category: "lessons",
      threshold: 5,
      xpReward: 50,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 100 });
    mockPrisma.lessonProgress.count.mockResolvedValue(5);

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ach-lessons");
    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: "u1", achievementId: "ach-lessons" }],
      }),
    );
  });

  // ── 4. Awards quiz pass achievement ─────────────────────────────────
  it("awards a quizzes achievement when quizzesPassed meets threshold", async () => {
    const ach = makeAchievement({
      id: "ach-quiz",
      key: "quiz_master",
      category: "quizzes",
      threshold: 3,
      xpReward: 30,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 0 });
    mockPrisma.quizAttempt.count.mockResolvedValue(3);

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("quiz_master");
    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: "u1", achievementId: "ach-quiz" }],
      }),
    );
  });

  // ── 5. Awards perfect_quiz ──────────────────────────────────────────
  it("awards perfect_quiz when user has a perfect score", async () => {
    const ach = makeAchievement({
      id: "ach-perfect",
      key: "perfect_quiz",
      category: "quizzes",
      threshold: 1,
      xpReward: 25,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 0 });
    mockPrisma.quizAttempt.findFirst.mockResolvedValue({
      score: 5,
      totalQuestions: 5,
    });

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("perfect_quiz");
  });

  // ── 6. Does NOT award perfect_quiz when score != totalQuestions ──────
  it("does not award perfect_quiz when score does not equal totalQuestions", async () => {
    const ach = makeAchievement({
      id: "ach-perfect",
      key: "perfect_quiz",
      category: "quizzes",
      threshold: 1,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 0 });
    mockPrisma.quizAttempt.findFirst.mockResolvedValue({
      score: 3,
      totalQuestions: 5,
    });

    const result = await checkAndAwardAchievements("u1");

    expect(result).toEqual([]);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });

  // ── 7. Awards first_enrollment ──────────────────────────────────────
  it("awards first_enrollment when user has at least one enrollment", async () => {
    const ach = makeAchievement({
      id: "ach-enroll",
      key: "first_enrollment",
      category: "onboarding",
      threshold: 1,
      xpReward: 5,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 0 });
    mockPrisma.enrollment.count.mockResolvedValue(1);

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("first_enrollment");
  });

  // ── 8. Does NOT award first_login ───────────────────────────────────
  it("does not award first_login (always returns false)", async () => {
    const ach = makeAchievement({
      id: "ach-login",
      key: "first_login",
      category: "onboarding",
      threshold: 1,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 0 });

    const result = await checkAndAwardAchievements("u1");

    expect(result).toEqual([]);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });

  // ── 9. Awards courses achievement when completed ────────────────────
  it("awards a courses achievement when user has completed enough courses", async () => {
    const ach = makeAchievement({
      id: "ach-course",
      key: "course_completer",
      category: "courses",
      threshold: 1,
      xpReward: 100,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 50 });

    // countCompletedCourses flow: enrollment.findMany -> module.findMany -> lessonProgress.count
    mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: "c1" }]);
    mockPrisma.module.findMany.mockResolvedValue([
      { lessons: [{ id: "l1" }, { id: "l2" }] },
    ]);
    // All 2 lessons completed
    mockPrisma.lessonProgress.count.mockResolvedValue(2);

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("course_completer");
    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: "u1", achievementId: "ach-course" }],
      }),
    );
  });

  // ── 10. Awards streaks achievement ──────────────────────────────────
  it("awards a streaks achievement when user streak meets threshold", async () => {
    const ach = makeAchievement({
      id: "ach-streak",
      key: "week_streak",
      category: "streaks",
      threshold: 7,
      xpReward: 20,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 7, xp: 0 });

    const result = await checkAndAwardAchievements("u1");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("week_streak");
  });

  // ── 11. Increments XP when stats exist ──────────────────────────────
  it("increments XP by sum of xpReward when userStats exist", async () => {
    const ach1 = makeAchievement({
      id: "ach-a",
      key: "a",
      category: "lessons",
      threshold: 1,
      xpReward: 10,
    });
    const ach2 = makeAchievement({
      id: "ach-b",
      key: "b",
      category: "lessons",
      threshold: 1,
      xpReward: 20,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach1, ach2]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 0, xp: 100 });
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    await checkAndAwardAchievements("u1");

    expect(mockPrisma.userStats.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { xp: { increment: 30 } },
    });
  });

  // ── 12. Does NOT increment XP when stats null ───────────────────────
  it("does not increment XP when userStats is null", async () => {
    const ach = makeAchievement({
      id: "ach-noxp",
      key: "lesson_1",
      category: "lessons",
      threshold: 1,
      xpReward: 15,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue(null); // no stats row
    mockPrisma.lessonProgress.count.mockResolvedValue(1);

    await checkAndAwardAchievements("u1");

    // Achievement should still be awarded
    expect(mockPrisma.userAchievement.createMany).toHaveBeenCalled();
    // But XP should not be incremented
    expect(mockPrisma.userStats.update).not.toHaveBeenCalled();
  });

  // ── 13. Unknown category -> not awarded ─────────────────────────────
  it("does not award an achievement with an unknown category", async () => {
    const ach = makeAchievement({
      id: "ach-unknown",
      key: "mystery",
      category: "unknown_category",
      threshold: 1,
    });
    mockPrisma.achievement.findMany.mockResolvedValue([ach]);
    mockPrisma.userStats.findUnique.mockResolvedValue({ streak: 10, xp: 999 });
    mockPrisma.lessonProgress.count.mockResolvedValue(100);
    mockPrisma.quizAttempt.count.mockResolvedValue(100);
    mockPrisma.enrollment.count.mockResolvedValue(100);

    const result = await checkAndAwardAchievements("u1");

    expect(result).toEqual([]);
    expect(mockPrisma.userAchievement.createMany).not.toHaveBeenCalled();
  });
});
