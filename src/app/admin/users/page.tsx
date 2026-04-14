import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserAvatar } from "@/components/ui/UserAvatar";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { instructedCourses: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          All Users
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {users.length} total
        </p>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Joined</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
            {users.map((user) => {
              const role = prismaRoleToApp(user.role);
              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        role === "admin"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : role === "manager"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : role === "instructor"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {role}
                      {role === "instructor" && user._count.instructedCourses > 0 && (
                        <span className="ml-1 opacity-70">
                          · {user._count.instructedCourses} course{user._count.instructedCourses !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
