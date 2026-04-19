import { computeDeadline } from "@/lib/deadlines";
import { prisma } from "@/lib/prisma";

export type ReminderKind = "due_soon_1" | "due_today" | "overdue_1";

export interface ReminderCandidate {
  userId: string;
  userEmail: string;
  userName: string | null;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  kind: ReminderKind;
  /** Signed days from now: 1 = tomorrow, 0 = today, -1 = yesterday */
  daysOffset: number;
}

export interface EnrollmentWithNested {
  userId: string;
  enrolledAt: Date;
  user: {
    email: string;
    name: string | null;
  };
  course: {
    id: string;
    title: string;
    modules: Array<{
      lessons: Array<{
        id: string;
        title: string;
        deadlineDays: number | null;
      }>;
    }>;
  };
  lessonProgressForUser: Array<{
    lessonId: string;
    completedAt: Date | null;
  }>;
}

/**
 * Pure function — no I/O. Computes which (user, lesson) pairs need a reminder
 * email based on `now`. Returns one candidate per qualifying pair.
 *
 * Kind mapping (calendar days from now, truncated to whole days):
 *   daysUntil === 1  → "due_soon_1"
 *   daysUntil === 0  → "due_today"
 *   daysUntil === -1 → "overdue_1"
 *   anything else   → skipped
 */
export function computeDueReminders(
  enrollments: EnrollmentWithNested[],
  now: Date,
): ReminderCandidate[] {
  const results: ReminderCandidate[] = [];
  const nowMidnight = utcMidnight(now);

  for (const enrollment of enrollments) {
    const completedSet = new Set(
      enrollment.lessonProgressForUser
        .filter((lp) => lp.completedAt != null)
        .map((lp) => lp.lessonId),
    );

    for (const mod of enrollment.course.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.deadlineDays == null) continue;
        if (completedSet.has(lesson.id)) continue;

        const deadline = computeDeadline(enrollment.enrolledAt, lesson.deadlineDays);
        const deadlineMidnight = utcMidnight(deadline);
        const diffDays = Math.round(
          (deadlineMidnight.getTime() - nowMidnight.getTime()) / 86_400_000,
        );

        let kind: ReminderKind | null = null;
        if (diffDays === 1) kind = "due_soon_1";
        else if (diffDays === 0) kind = "due_today";
        else if (diffDays === -1) kind = "overdue_1";

        if (!kind) continue;

        results.push({
          userId: enrollment.userId,
          userEmail: enrollment.user.email,
          userName: enrollment.user.name,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseId: enrollment.course.id,
          courseTitle: enrollment.course.title,
          kind,
          daysOffset: diffDays,
        });
      }
    }
  }

  return results;
}

/** Truncate a Date to midnight UTC for whole-day arithmetic. */
function utcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

// ---------------------------------------------------------------------------
// Admin widget helper
// ---------------------------------------------------------------------------

export interface OverdueLesson {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  daysOverdue: number;
}

/**
 * Returns overdue + incomplete lessons for a single user, ordered by most
 * overdue first. Used by the admin user detail page widget.
 */
export async function getOverdueForUser(userId: string): Promise<OverdueLesson[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: {
      enrolledAt: true,
      course: {
        select: {
          id: true,
          title: true,
          modules: {
            select: {
              lessons: {
                where: { deadlineDays: { not: null } },
                select: { id: true, title: true, deadlineDays: true },
              },
            },
          },
        },
      },
    },
  });

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, completedAt: { not: null } },
    select: { lessonId: true },
  });
  const completedSet = new Set(progressRows.map((p) => p.lessonId));

  const now = new Date();
  const results: OverdueLesson[] = [];

  for (const enrollment of enrollments) {
    for (const mod of enrollment.course.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.deadlineDays) continue;
        if (completedSet.has(lesson.id)) continue;

        const deadline = computeDeadline(enrollment.enrolledAt, lesson.deadlineDays);
        const msOverdue = now.getTime() - deadline.getTime();
        if (msOverdue <= 0) continue;

        const daysOverdue = Math.max(1, Math.floor(msOverdue / 86_400_000));
        results.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseId: enrollment.course.id,
          courseTitle: enrollment.course.title,
          daysOverdue,
        });
      }
    }
  }

  results.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return results;
}
