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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-1 text-xs text-foreground-muted">
        <Link href="/profile" className="hover:underline">
          Profile
        </Link>
        {" / "}
        <span className="text-foreground">Achievements</span>
      </p>
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-foreground">
        Achievements
      </h1>
      <p className="mb-8 text-sm text-foreground-muted">
        {earnedCount} of {allAchievements.length} unlocked
      </p>

      <div className="space-y-8">
        {categories.map((category) => {
          const items = achievements.filter((a) => a.category === category);
          return (
            <div key={category}>
              <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
