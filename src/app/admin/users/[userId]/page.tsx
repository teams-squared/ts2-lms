import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserDetailManager } from "@/components/admin/UserDetailManager";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/admin");
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) notFound();

  const [userClearances, distinctClearances, enrollmentCount, authoredCount] =
    await Promise.all([
      prisma.userClearance.findMany({
        where: { userId },
        orderBy: { grantedAt: "asc" },
      }),
      prisma.course.findMany({
        where: { requiredClearance: { not: null } },
        select: { requiredClearance: true },
        distinct: ["requiredClearance"],
      }),
      prisma.enrollment.count({ where: { userId } }),
      prisma.course.count({ where: { createdById: userId } }),
    ]);

  const availableClearances = distinctClearances
    .map((c) => c.requiredClearance!)
    .filter((cl) => !userClearances.some((uc) => uc.clearance === cl));

  const sessionUserId = session.user!.id!;

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-foreground-muted mb-1">
          <Link href="/admin/users" className="hover:underline">Users</Link>
          {" / "}
          <span className="text-foreground">{user.name || user.email}</span>
        </p>
        <h2 className="text-base font-semibold text-foreground">
          {user.name || "Unnamed"}
        </h2>
        <p className="text-xs text-foreground-muted">{user.email}</p>
      </div>

      <UserDetailManager
        userId={user.id}
        userEmail={user.email}
        userName={user.name}
        initialRole={prismaRoleToApp(user.role)}
        initialClearances={userClearances.map((uc) => uc.clearance)}
        availableClearances={availableClearances}
        enrollmentCount={enrollmentCount}
        authoredCourseCount={authoredCount}
        sessionUserId={sessionUserId}
      />
    </div>
  );
}
