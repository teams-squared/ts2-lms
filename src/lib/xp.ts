import { prisma } from "./prisma";
import { checkAndAwardAchievements } from "./achievements";

/**
 * Award XP to a user, update their streak, and check for new achievements.
 * Returns any newly unlocked achievements.
 */
export async function awardXp(userId: string, amount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.userStats.findUnique({ where: { userId } });

  let newStreak = 1;
  if (existing?.lastActivityDate) {
    const last = new Date(existing.lastActivityDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      newStreak = existing.streak; // same day — keep current streak
    } else if (diffDays === 1) {
      newStreak = existing.streak + 1; // consecutive day
    }
    // else diffDays > 1 → streak resets to 1
  }

  const stats = await prisma.userStats.upsert({
    where: { userId },
    create: { userId, xp: amount, streak: newStreak, lastActivityDate: today },
    update: {
      xp: { increment: amount },
      streak: newStreak,
      lastActivityDate: today,
    },
  });

  const newAchievements = await checkAndAwardAchievements(userId);

  return { stats, newAchievements };
}

// Re-export for server-side callers
export { calculateLevel } from "./levels";
