import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserDetailManager } from "@/components/admin/UserDetailManager";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      instructedCourses: {
        select: {
          assignedAt: true,
          course: { select: { id: true, title: true, status: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!user) notFound();

  const allCourses = await prisma.course.findMany({
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });

  const assignedCourseIds = new Set(user.instructedCourses.map((ic) => ic.course.id));

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          <Link href="/admin/users" className="hover:underline">Users</Link>
          {" / "}
          <span className="text-gray-700 dark:text-gray-300">{user.name || user.email}</span>
        </p>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {user.name || "Unnamed"}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
      </div>

      <UserDetailManager
        userId={user.id}
        initialRole={prismaRoleToApp(user.role)}
        initialAssignedCourses={user.instructedCourses.map((ic) => ({
          id: ic.course.id,
          title: ic.course.title,
          status: ic.course.status.toLowerCase() as "draft" | "published" | "archived",
          assignedAt: ic.assignedAt.toISOString(),
        }))}
        allCourses={allCourses
          .filter((c) => !assignedCourseIds.has(c.id))
          .map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status.toLowerCase() as "draft" | "published" | "archived",
          }))}
      />
    </div>
  );
}
