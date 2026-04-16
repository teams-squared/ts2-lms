import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";

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
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.course.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

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
                  <UserAvatar name={user.name} size="sm" />
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
