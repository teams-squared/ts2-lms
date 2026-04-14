import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UsersIcon, GraduationCapIcon, BarChartIcon } from "@/components/icons";
import UserTable from "@/components/admin/UserTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [totalUsers, adminCount, managerCount, instructorCount, employeeCount, totalCourses] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "MANAGER" } }),
      prisma.user.count({ where: { role: "INSTRUCTOR" } }),
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.course.count(),
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
      {/* Stats cards */}
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
              <div className="text-sm text-gray-500 dark:text-gray-500 font-medium">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/admin/users"
          className="p-5 rounded-xl border border-brand-200 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-950/20 shadow-card hover:shadow-elevated hover-lift"
        >
          <UsersIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            User Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage users, roles and instructor assignments
          </p>
        </Link>
        <Link
          href="/admin/courses"
          className="p-5 rounded-xl border border-brand-200 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-950/20 shadow-card hover:shadow-elevated hover-lift"
        >
          <GraduationCapIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Course Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage courses
          </p>
        </Link>
        <Link
          href="/admin/assignments"
          className="p-5 rounded-xl border border-brand-200 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-950/20 shadow-card hover:shadow-elevated hover-lift"
        >
          <GraduationCapIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Assignments
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Assign courses to users
          </p>
        </Link>
        <Link
          href="/admin/analytics"
          className="p-5 rounded-xl border border-brand-200 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-950/20 shadow-card hover:shadow-elevated hover-lift"
        >
          <BarChartIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Course activity and user progress
          </p>
        </Link>
      </div>

      {/* User table */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <UsersIcon className="w-4 h-4" />
          All Users
        </h2>
        <UserTable />
      </div>
    </div>
  );
}
