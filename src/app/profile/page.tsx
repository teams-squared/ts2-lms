import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/Badge";
import { prismaRoleToApp } from "@/lib/types";
import { EditNameForm } from "@/components/profile/EditNameForm";

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
    </div>
  );
}
