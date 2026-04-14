import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AchievementCard } from "@/components/gamification/AchievementCard";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Getting Started",
  lessons: "Lessons",
  quizzes: "Quizzes",
  courses: "Courses",
  streaks: "Streaks",
};

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [allAchievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { threshold: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { userId: session.user.id },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const unlockedMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]),
  );

  const achievements = allAchievements.map((a) => ({
    ...a,
    unlockedAt: unlockedMap.get(a.id) ?? null,
  }));

  // Group by category
  const categories = [...new Set(achievements.map((a) => a.category))];
  const earnedCount = userAchievements.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        <Link href="/profile" className="hover:underline">
          Profile
        </Link>
        {" / "}
        <span className="text-gray-700 dark:text-gray-300">Achievements</span>
      </p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-2">
        Achievements
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        {earnedCount} of {allAchievements.length} unlocked
      </p>

      <div className="space-y-8">
        {categories.map((category) => {
          const items = achievements.filter((a) => a.category === category);
          return (
            <div key={category}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((a) => (
                  <AchievementCard
                    key={a.id}
                    icon={a.icon}
                    title={a.title}
                    description={a.description}
                    unlockedAt={a.unlockedAt?.toISOString() ?? null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
