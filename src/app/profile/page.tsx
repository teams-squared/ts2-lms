import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/Badge";
import { prismaRoleToApp } from "@/lib/types";
import { EditNameForm } from "@/components/profile/EditNameForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { XpProgressBar } from "@/components/gamification/XpProgressBar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { AchievementCard } from "@/components/gamification/AchievementCard";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/login");

  const role = prismaRoleToApp(user.role);

  // Fetch enrollment and completion stats
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          modules: {
            include: { lessons: { select: { id: true } } },
          },
        },
      },
    },
  });

  const allLessonIds = enrollments.flatMap((e) =>
    e.course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  );

  const completedProgress = await prisma.lessonProgress.findMany({
    where: {
      userId: user.id,
      lessonId: { in: allLessonIds },
      completedAt: { not: null },
    },
    select: { lessonId: true },
  });

  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  // Fetch gamification data
  const [userStats, allAchievements, userAchievements] = await Promise.all([
    prisma.userStats.findUnique({ where: { userId: user.id } }),
    prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { threshold: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const xp = userStats?.xp ?? 0;
  const streak = userStats?.streak ?? 0;
  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]));
  const recentAchievements = allAchievements
    .map((a) => ({ ...a, unlockedAt: unlockedMap.get(a.id) ?? null }))
    .filter((a) => a.unlockedAt)
    .sort((a, b) => (b.unlockedAt!.getTime() - a.unlockedAt!.getTime()))
    .slice(0, 6);

  // Count courses where all lessons are completed
  const completedCourses = enrollments.filter((e) => {
    const courseLessonIds = e.course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );
    return (
      courseLessonIds.length > 0 &&
      courseLessonIds.every((id) => completedLessonIds.has(id))
    );
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-6">
        My Profile
      </h1>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="p-6 flex items-start gap-5 border-b border-gray-100 dark:border-[#2e2e3a]">
          <UserAvatar name={user.name} size="lg" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {user.name || "Unnamed User"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={role} />
            </div>
            <EditNameForm currentName={user.name} />
            <ChangePasswordForm isSsoOnly={!user.passwordHash} />
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
          <div className="px-6 py-4 flex justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Member since
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {user.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="px-6 py-4 flex justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Enrolled courses
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {enrollments.length}
            </span>
          </div>
          <div className="px-6 py-4 flex justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Completed courses
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {completedCourses.length}
            </span>
          </div>
        </div>
      </div>

      {/* Gamification section */}
      <div className="mt-8 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-[#2e2e3a]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Progress
            </h2>
            <StreakBadge streak={streak} />
          </div>
          <XpProgressBar xp={xp} />
        </div>

        {recentAchievements.length > 0 && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Recent Achievements
              </h3>
              <Link
                href="/profile/achievements"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentAchievements.map((a) => (
                <AchievementCard
                  key={a.id}
                  icon={a.icon}
                  title={a.title}
                  description={a.description}
                  unlockedAt={a.unlockedAt?.toISOString()}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
