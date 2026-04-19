import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";
import { UserDetailManager } from "@/components/admin/UserDetailManager";
import { getOverdueForUser } from "@/lib/deadline-reminders";

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

  const [userClearances, distinctClearances, enrollmentCount, authoredCount, overdueList] =
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
      getOverdueForUser(userId),
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

      {overdueList.length > 0 && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger-subtle p-4">
          <h3 className="text-sm font-semibold text-danger mb-3">
            Overdue lessons: {overdueList.length}
          </h3>
          <ul className="space-y-2">
            {overdueList.slice(0, 5).map((item) => (
              <li key={item.lessonId} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
                    className="font-medium text-foreground hover:underline truncate block"
                  >
                    {item.lessonTitle}
                  </Link>
                  <p className="text-xs text-foreground-muted truncate">{item.courseTitle}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-danger">
                  {item.daysOverdue === 1 ? "1 day overdue" : `${item.daysOverdue} days overdue`}
                </span>
              </li>
            ))}
          </ul>
          {overdueList.length > 5 && (
            <p className="mt-2 text-xs text-foreground-muted">
              +{overdueList.length - 5} more overdue
            </p>
          )}
        </div>
      )}
    </div>
  );
}
