import { prisma } from "@/lib/prisma";
import { UsersIcon } from "@/components/icons";
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
