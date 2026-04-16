import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserList } from "@/components/admin/UserList";

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
    <UserList
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: prismaRoleToApp(u.role),
        createdAt: u.createdAt.toISOString(),
        instructedCoursesCount: u._count.instructedCourses,
      }))}
    />
  );
}
