import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import type { Role } from "@/lib/types";
import { getNodeTree } from "@/lib/courseNodes";
import { UserList } from "@/components/admin/UserList";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/admin");
  }

  const [users, nodeTree] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getNodeTree({ publishedOnly: true }),
  ]);

  const inviterRole = (session.user?.role as Role) ?? "employee";

  return (
    <UserList
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatar: u.avatar,
        role: prismaRoleToApp(u.role),
        createdAt: u.createdAt.toISOString(),
      }))}
      nodeTree={nodeTree}
      inviterRole={inviterRole}
    />
  );
}
