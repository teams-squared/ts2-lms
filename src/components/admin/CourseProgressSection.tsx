import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listManagedCourseIds } from "@/lib/courseAccess";
import { computeDeadline } from "@/lib/deadlines";
import { ProgressBar } from "@/components/app/ProgressBar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  UsersIcon,
} from "@/components/icons";

type StudentRow = {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  enrollmentCompleted: boolean;
  overdueLessons: string[];
};

type CourseSegment = {
  courseId: string;
  title: string;
  totalLessons: number;
  enrolledCount: number;
  completedCount: number;
  rows: StudentRow[];
};

export async function CourseProgressSection() {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id as string;
  const role = session.user.role;
  if (role !== "admin" && role !== "course_manager") return null;

  const managedIds = await listManagedCourseIds(userId, role);
  const where = managedIds === null ? {} : { id: { in: managedIds } };

  const courses = await prisma.course.findMany({
    where,
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      modules: {
        select: {
          lessons: {
            select: { id: true, title: true, deadlineDays: true },
          },
        },
      },
      enrollments: {
        select: {
          userId: true,
          enrolledAt: true,
          completedAt: true,
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      },
    },
  });

  if (courses.length === 0) {
    return (
      <div className="mb-8 rounded-lg border border-border bg-surface shadow-sm p-6 text-center">
        <UsersIcon className="w-6 h-6 mx-auto text-foreground-subtle mb-2" />
        <p className="text-sm font-medium text-foreground mb-1">
          No managed courses yet
        </p>
        <p className="text-xs text-foreground-muted">
          Ask an admin to assign you as a manager on a course.
        </p>
      </div>
    );
  }

  const allLessonIds = courses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
  );

  const completed = allLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { lessonId: { in: allLessonIds }, completedAt: { not: null } },
        select: { userId: true, lessonId: true },
      })
    : [];

  const completedByUser = new Map<string, Set<string>>();
  for (const p of completed) {
    let set = completedByUser.get(p.userId);
    if (!set) {
      set = new Set<string>();
      completedByUser.set(p.userId, set);
    }
    set.add(p.lessonId);
  }

  const now = new Date();
  const segments: CourseSegment[] = courses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    const totalLessons = lessons.length;

    const rows: StudentRow[] = c.enrollments.map((e) => {
      const userCompleted = completedByUser.get(e.userId) ?? new Set<string>();
      const completedLessons = lessons.reduce(
        (n, l) => (userCompleted.has(l.id) ? n + 1 : n),
        0,
      );
      const enrollmentCompleted = e.completedAt !== null;
      const effectiveCompleted = enrollmentCompleted
        ? totalLessons
        : completedLessons;
      const percent =
        totalLessons === 0
          ? 0
          : Math.round((effectiveCompleted / totalLessons) * 100);

      const overdueLessons: string[] = [];
      if (!enrollmentCompleted) {
        for (const l of lessons) {
          if (l.deadlineDays == null) continue;
          if (userCompleted.has(l.id)) continue;
          const deadline = computeDeadline(e.enrolledAt, l.deadlineDays);
          if (deadline < now) overdueLessons.push(l.title);
        }
      }

      return {
        userId: e.userId,
        name: e.user.name || "Unnamed",
        email: e.user.email,
        avatar: e.user.avatar,
        percent,
        completedLessons: effectiveCompleted,
        totalLessons,
        enrollmentCompleted,
        overdueLessons,
      };
    });

    rows.sort((a, b) => {
      if (b.overdueLessons.length !== a.overdueLessons.length) {
        return b.overdueLessons.length - a.overdueLessons.length;
      }
      return a.percent - b.percent;
    });

    return {
      courseId: c.id,
      title: c.title,
      totalLessons,
      enrolledCount: c.enrollments.length,
      completedCount: rows.filter((r) => r.enrollmentCompleted).length,
      rows,
    };
  });

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Student Progress by Course
        </h2>
      </div>
      {segments.map((seg) => (
        <CourseSegmentCard key={seg.courseId} segment={seg} />
      ))}
    </div>
  );
}

function CourseSegmentCard({ segment }: { segment: CourseSegment }) {
  const totalOverdue = segment.rows.reduce(
    (n, r) => n + r.overdueLessons.length,
    0,
  );

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {segment.title}
          </p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {segment.enrolledCount} enrolled · {segment.completedCount} completed
            · {segment.totalLessons} lesson
            {segment.totalLessons === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {totalOverdue > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
              <AlertTriangleIcon className="w-3 h-3" />
              {totalOverdue} overdue
            </span>
          )}
          <Button asChild variant="ghost" size="xs">
            <Link href={`/admin/courses/${segment.courseId}/edit`}>
              Manage →
            </Link>
          </Button>
        </div>
      </div>

      {segment.rows.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-foreground-muted">
          No enrollments yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left bg-surface-muted">
                <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                  Student
                </th>
                <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                  Progress
                </th>
                <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                  Overdue lessons
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {segment.rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={row.name}
                        image={row.avatar}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {row.name}
                        </p>
                        <p className="text-xs text-foreground-muted truncate">
                          {row.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top w-[18rem]">
                    {row.enrollmentCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                        <CheckCircleIcon className="w-3 h-3" />
                        Completed
                      </span>
                    ) : row.completedLessons === 0 ? (
                      <span className="text-xs text-foreground-muted">
                        Not started
                      </span>
                    ) : (
                      <ProgressBar
                        value={row.percent}
                        label={`${row.name} progress`}
                        caption={`${row.completedLessons} of ${row.totalLessons} lessons`}
                        showPercent
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {row.overdueLessons.length === 0 ? (
                      <span className="text-xs text-foreground-subtle">—</span>
                    ) : (
                      <details className="group">
                        <summary className="cursor-pointer list-none inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
                          <AlertTriangleIcon className="w-3 h-3" />
                          {row.overdueLessons.length} overdue
                        </summary>
                        <ul className="mt-2 ml-1 space-y-0.5 text-xs text-foreground-muted">
                          {row.overdueLessons.map((title) => (
                            <li key={title}>· {title}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CourseProgressSkeleton() {
  return (
    <div className="mb-8 rounded-lg border border-border bg-surface shadow-sm overflow-hidden p-5 animate-pulse">
      <div className="h-4 w-40 bg-border rounded mb-3" />
      <div className="h-3 w-full bg-border rounded mb-2" />
      <div className="h-3 w-3/4 bg-border rounded" />
    </div>
  );
}
