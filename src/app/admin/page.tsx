import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { AlertTriangleIcon } from "@/components/icons";
import { computeDeadline } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

async function OverdueSection() {
  const lessonsWithDeadlines = await prisma.lesson.findMany({
    where: { deadlineDays: { not: null } },
    select: {
      id: true,
      title: true,
      deadlineDays: true,
      module: { select: { course: { select: { id: true, title: true } } } },
    },
  });

  if (lessonsWithDeadlines.length === 0) return null;

  const lessonIds = lessonsWithDeadlines.map((l) => l.id);
  const courseIds = [...new Set(lessonsWithDeadlines.map((l) => l.module.course.id))];

  const [enrollments, completedProgress] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        userId: true,
        courseId: true,
        enrolledAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { lessonId: { in: lessonIds }, completedAt: { not: null } },
      select: { userId: true, lessonId: true },
    }),
  ]);

  const completedSet = new Set(
    completedProgress.map((p) => `${p.userId}:${p.lessonId}`),
  );

  const enrollmentsByCourse = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const arr = enrollmentsByCourse.get(e.courseId);
    if (arr) arr.push(e);
    else enrollmentsByCourse.set(e.courseId, [e]);
  }

  const now = new Date();
  type OverdueItem = {
    userName: string;
    userEmail: string;
    courseTitle: string;
    lessonTitle: string;
    dueDate: Date;
    daysOverdue: number;
  };
  const overdueItems: OverdueItem[] = [];

  for (const lesson of lessonsWithDeadlines) {
    const courseId = lesson.module.course.id;
    const courseEnrollments = enrollmentsByCourse.get(courseId) ?? [];
    for (const enrollment of courseEnrollments) {
      const key = `${enrollment.userId}:${lesson.id}`;
      if (completedSet.has(key)) continue;
      const deadline = computeDeadline(enrollment.enrolledAt, lesson.deadlineDays!);
      if (deadline < now) {
        const daysOverdue = Math.max(
          1,
          Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)),
        );
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

  if (overdueItems.length === 0) return null;
  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const overdueCount = overdueItems.length;

  return (
    <div className="mb-8 rounded-lg border border-danger/30 bg-danger-subtle shadow-sm overflow-hidden">
      <div className="h-1 bg-danger" />
      <div className="p-5 flex items-center gap-3">
        <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />
        <div>
          <div className="text-2xl font-bold text-danger tabular-nums">
            {overdueCount}
          </div>
          <div className="text-sm text-danger font-medium">
            Overdue Lesson{overdueCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t border-danger/20 text-left">
            <th className="px-4 py-3 text-xs font-medium text-danger/80">User</th>
            <th className="px-4 py-3 text-xs font-medium text-danger/80">Course</th>
            <th className="px-4 py-3 text-xs font-medium text-danger/80">Lesson</th>
            <th className="px-4 py-3 text-xs font-medium text-danger/80 text-right">Due Date</th>
            <th className="px-4 py-3 text-xs font-medium text-danger/80 text-right">Days Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-danger/20">
          {overdueItems.slice(0, 10).map((item, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <p className="text-foreground font-medium">{item.userName}</p>
                <p className="text-xs text-foreground-muted">{item.userEmail}</p>
              </td>
              <td className="px-4 py-3 text-foreground">{item.courseTitle}</td>
              <td className="px-4 py-3 text-foreground">{item.lessonTitle}</td>
              <td className="px-4 py-3 text-right text-foreground-muted">
                {item.dueDate.toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-danger font-medium">{item.daysOverdue}d</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverdueSkeleton() {
  return (
    <div className="mb-8 rounded-lg border border-border bg-card shadow-sm overflow-hidden p-5 animate-pulse">
      <div className="h-4 w-40 bg-border rounded mb-3" />
      <div className="h-3 w-full bg-border rounded" />
    </div>
  );
}

export default async function AdminPage() {
  const [
    totalUsers,
    adminCount,
    courseManagerCount,
    employeeCount,
    totalCourses,
    recentUsers,
    recentCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "COURSE_MANAGER" } }),
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

  const stats = [
    { value: totalUsers, label: "Total Users" },
    { value: adminCount, label: "Admins" },
    { value: courseManagerCount, label: "Course Managers" },
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
            className="rounded-lg border border-border bg-surface shadow-sm hover-lift overflow-hidden"
          >
            <div className="h-1 bg-primary" />
            <div className="p-5">
              <div className="text-2xl font-bold text-primary tabular-nums mb-1">
                {value}
              </div>
              <div className="text-sm text-foreground-muted font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue lessons — streamed independently so stats paint immediately */}
      <Suspense fallback={<OverdueSkeleton />}>
        <OverdueSection />
      </Suspense>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Signups</h2>
            <Link href="/admin/users" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-sm divide-y divide-border">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={user.name} image={user.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-foreground-muted truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-foreground-subtle">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-primary hover:underline"
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
            <h2 className="text-sm font-semibold text-foreground">Recent Courses</h2>
            <Link href="/admin/courses" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-sm divide-y divide-border">
            {recentCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {course.title}
                  </p>
                  <p className="text-xs text-foreground-subtle mt-0.5">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <CourseStatusBadge status={course.status.toLowerCase() as "draft" | "published" | "archived"} />
                  <Link
                    href={`/admin/courses/${course.id}/edit`}
                    className="text-xs text-primary hover:underline"
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
