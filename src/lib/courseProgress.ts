import { prisma } from "@/lib/prisma";
import { listManagedCourseIds } from "@/lib/courseAccess";
import { computeDeadline } from "@/lib/deadlines";
import type { Role } from "@/lib/types";

export type StudentRow = {
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

export type CourseSegment = {
  courseId: string;
  title: string;
  totalLessons: number;
  enrolledCount: number;
  completedCount: number;
  overdueCount: number;
  rows: StudentRow[];
};

/**
 * Load per-course student progress for an admin or course_manager.
 * Returns null if caller is neither role.
 */
export async function loadCourseProgress(
  userId: string,
  role: Role,
): Promise<CourseSegment[] | null> {
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
  return courses.map((c) => {
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
      overdueCount: rows.reduce((n, r) => n + r.overdueLessons.length, 0),
      rows,
    };
  });
}
