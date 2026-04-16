import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { AlertTriangleIcon } from "@/components/icons";
import { computeDeadline } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [
    totalUsers, adminCount, managerCount, instructorCount, employeeCount, totalCourses,
    recentUsers, recentCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "MANAGER" } }),
    prisma.user.count({ where: { role: "INSTRUCTOR" } }),
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.course.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.course.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Compute overdue lessons across all enrollments
  const lessonsWithDeadlines = await prisma.lesson.findMany({
    where: { deadlineDays: { not: null } },
    select: { id: true, title: true, deadlineDays: true, module: { select: { course: { select: { id: true, title: true } } } } },
  });

  const now = new Date();
  type OverdueItem = { userName: string; userEmail: string; courseTitle: string; lessonTitle: string; dueDate: Date; daysOverdue: number };
  const overdueItems: OverdueItem[] = [];

  if (lessonsWithDeadlines.length > 0) {
    const lessonIds = lessonsWithDeadlines.map((l) => l.id);
    const courseIds = [...new Set(lessonsWithDeadlines.map((l) => l.module.course.id))];

    const [enrollments, completedProgress] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        select: { userId: true, courseId: true, enrolledAt: true, user: { select: { name: true, email: true } } },
      }),
      prisma.lessonProgress.findMany({
        where: { lessonId: { in: lessonIds }, completedAt: { not: null } },
        select: { userId: true, lessonId: true },
      }),
    ]);

    const completedSet = new Set(completedProgress.map((p) => `${p.userId}:${p.lessonId}`));

    for (const lesson of lessonsWithDeadlines) {
      const courseId = lesson.module.course.id;
      const courseEnrollments = enrollments.filter((e) => e.courseId === courseId);
      for (const enrollment of courseEnrollments) {
        const key = `${enrollment.userId}:${lesson.id}`;
        if (completedSet.has(key)) continue;
        const deadline = computeDeadline(enrollment.enrolledAt, lesson.deadlineDays!);
        if (deadline < now) {
          const daysOverdue = Math.max(1, Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)));
          overdueItems.push({
            userName: enrollment.user.name || "Unnamed",
            userEmail: enrollment.user.email,
            courseTitle: lesson.module.course.title,
            lessonTitle: lesson.title,
            dueDate: deadline,
            daysOverdue,
          });
        }
      }
    }
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  const overdueCount = overdueItems.length;

  const stats = [
    { value: totalUsers, label: "Total Users" },
    { value: adminCount, label: "Admins" },
    { value: managerCount, label: "Managers" },
    { value: instructorCount, label: "Instructors" },
    { value: employeeCount, label: "Employees" },
    { value: totalCourses, label: "Courses" },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(({ value, label }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover-lift overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400" />
            <div className="p-5">
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums mb-1">
                {value}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-500 font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue lessons */}
      {overdueCount > 0 && (
        <div className="mb-8 rounded-xl border border-red-200/80 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 shadow-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-500 to-red-400" />
          <div className="p-5 flex items-center gap-3">
            <AlertTriangleIcon className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                {overdueCount}
              </div>
              <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                Overdue Lesson{overdueCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-red-200/60 dark:border-red-800/20 text-left">
                <th className="px-4 py-3 text-xs font-medium text-red-700/70 dark:text-red-300/70">User</th>
                <th className="px-4 py-3 text-xs font-medium text-red-700/70 dark:text-red-300/70">Course</th>
                <th className="px-4 py-3 text-xs font-medium text-red-700/70 dark:text-red-300/70">Lesson</th>
                <th className="px-4 py-3 text-xs font-medium text-red-700/70 dark:text-red-300/70 text-right">Due Date</th>
                <th className="px-4 py-3 text-xs font-medium text-red-700/70 dark:text-red-300/70 text-right">Days Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-200/40 dark:divide-red-800/20">
              {overdueItems.slice(0, 10).map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 dark:text-gray-100 font-medium">{item.userName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.courseTitle}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.lessonTitle}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                    {item.dueDate.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-red-600 dark:text-red-400 font-medium">{item.daysOverdue}d</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Signups</h2>
            <Link href="/admin/users" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card divide-y divide-gray-100 dark:divide-[#26262e]">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={user.name} image={user.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Manage →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent courses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Courses</h2>
            <Link href="/admin/courses" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card divide-y divide-gray-100 dark:divide-[#26262e]">
            {recentCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {course.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <CourseStatusBadge status={course.status.toLowerCase() as "draft" | "published" | "archived"} />
                  <Link
                    href={`/admin/courses/${course.id}/edit`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Edit →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
