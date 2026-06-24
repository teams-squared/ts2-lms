import { prisma } from "./prisma";

interface AwardedAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

/**
 * Check all achievement conditions for a user and award any newly earned ones.
 * Returns the list of newly unlocked achievements.
 */
export async function checkAndAwardAchievements(userId: string): Promise<AwardedAchievement[]> {
  // Fetch all achievements and which ones the user already has
  const [allAchievements, userAchievements, stats] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
    prisma.userStats.findUnique({ where: { userId } }),
  ]);

  if (!allAchievements || allAchievements.length === 0) return [];

  const earnedIds = new Set((userAchievements ?? []).map((ua) => ua.achievementId));
  const unearnedAchievements = allAchievements.filter((a) => !earnedIds.has(a.id));

  if (unearnedAchievements.length === 0) return [];

  // Gather counts for threshold checks
  const counts = await getUserCounts(userId);
  const streak = stats?.streak ?? 0;

  const newlyEarned: AwardedAchievement[] = [];

  for (const achievement of unearnedAchievements) {
    const met = isThresholdMet(achievement.key, achievement.category, achievement.threshold, counts, streak);
    if (met) {
      newlyEarned.push({
        id: achievement.id,
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
      });
    }
  }

  if (newlyEarned.length > 0) {
    // Award achievements
    await prisma.userAchievement.createMany({
      data: newlyEarned.map((a) => ({ userId, achievementId: a.id })),
      skipDuplicates: true,
    });

    // Award bonus XP from achievements
    const bonusXp = newlyEarned.reduce((sum, a) => sum + a.xpReward, 0);
    if (bonusXp > 0 && stats) {
      await prisma.userStats.update({
        where: { userId },
        data: { xp: { increment: bonusXp } },
      });
    }
  }

  return newlyEarned;
}

interface UserCounts {
  lessonsCompleted: number;
  quizzesPassed: number;
  hasPerfectQuiz: boolean;
  coursesCompleted: number;
  enrollments: number;
}

async function getUserCounts(userId: string): Promise<UserCounts> {
  const [lessonsCompleted, quizzesPassed, perfectQuiz, enrollments] = await Promise.all([
    prisma.lessonProgress.count({
      where: { userId, completedAt: { not: null } },
    }),
    prisma.quizAttempt.count({
      where: { userId, passed: true },
    }),
    prisma.quizAttempt.findFirst({
      where: { userId, passed: true },
      // Perfect score: score equals totalQuestions
      orderBy: { createdAt: "desc" },
    }),
    prisma.enrollment.count({ where: { userId } }),
  ]);

  // Count completed courses: courses where ALL lessons are completed
  const coursesCompleted = await countCompletedCourses(userId);

  return {
    lessonsCompleted,
    quizzesPassed,
    hasPerfectQuiz: perfectQuiz ? perfectQuiz.score === perfectQuiz.totalQuestions : false,
    coursesCompleted,
    enrollments,
  };
}

async function countCompletedCourses(userId: string): Promise<number> {
  // Two queries regardless of enrollment count (was 1 + 2 per enrolled
  // course, run synchronously on every lesson completion): pull each
  // enrolled course's lesson ids, then one progress lookup over their union.
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: {
      course: {
        select: {
          modules: { select: { lessons: { select: { id: true } } } },
        },
      },
    },
  });

  const courseLessonIds = enrollments.map((e) =>
    e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
  );
  const allLessonIds = [...new Set(courseLessonIds.flat())];
  if (allLessonIds.length === 0) return 0;

  const completedRows = await prisma.lessonProgress.findMany({
    where: { userId, completedAt: { not: null }, lessonId: { in: allLessonIds } },
    select: { lessonId: true },
  });
  const completedSet = new Set(completedRows.map((r) => r.lessonId));

  let completed = 0;
  for (const lessonIds of courseLessonIds) {
    if (lessonIds.length === 0) continue;
    if (lessonIds.every((id) => completedSet.has(id))) completed++;
  }
  return completed;
}

function isThresholdMet(
  key: string,
  category: string,
  threshold: number,
  counts: UserCounts,
  streak: number,
): boolean {
  switch (category) {
    case "onboarding":
      if (key === "first_enrollment") return counts.enrollments >= threshold;
      // first_login is awarded separately at login time
      return false;
    case "lessons":
      return counts.lessonsCompleted >= threshold;
    case "quizzes":
      if (key === "perfect_quiz") return counts.hasPerfectQuiz;
      return counts.quizzesPassed >= threshold;
    case "courses":
      return counts.coursesCompleted >= threshold;
    case "streaks":
      return streak >= threshold;
    default:
      return false;
  }
}
