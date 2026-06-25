import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { sendCourseCompletionEmail } from "@/lib/email";

/** XP bonus awarded once when a user completes every lesson in a module. */
export const MODULE_COMPLETION_XP = 25;

/**
 * Validate that every `moduleId` belongs to `courseId`. Returns the IDs that do
 * NOT (empty = all valid). Used by the enroll + scope-edit endpoints to reject a
 * scope that references modules outside the course.
 */
export async function modulesNotInCourse(
  courseId: string,
  moduleIds: string[],
): Promise<string[]> {
  if (moduleIds.length === 0) return [];
  const found = await prisma.module.findMany({
    where: { id: { in: moduleIds }, courseId },
    select: { id: true },
  });
  const foundSet = new Set(found.map((m) => m.id));
  return moduleIds.filter((id) => !foundSet.has(id));
}

export interface CreateEnrollmentsInput {
  userId: string;
  courseIds: string[];
  enrolledById: string | null;
}

export interface CreateEnrollmentsResult {
  created: {
    id: string;
    course: { id: string; title: string };
    user: { id: string; name: string | null; email: string };
    enrolledAt: Date;
  }[];
  skipped: string[];
  invalid: string[];
  courseTitleMap: Map<string, string>;
}

/**
 * Create enrollments for a user across multiple courses within a Prisma
 * transaction. Skips courses the user is already enrolled in, ignores course
 * IDs that don't exist, and creates an in-app notification per new enrollment.
 *
 * Caller is responsible for post-transaction side effects (XP, analytics,
 * transactional email, etc.) — these are intentionally not part of this
 * helper because different callers (admin batch enroll vs. invite
 * pre-enrollment) want different side effects.
 */
export async function createEnrollments(
  tx: Prisma.TransactionClient,
  { userId, courseIds, enrolledById }: CreateEnrollmentsInput,
): Promise<CreateEnrollmentsResult> {
  if (courseIds.length === 0) {
    return {
      created: [],
      skipped: [],
      invalid: [],
      courseTitleMap: new Map(),
    };
  }

  const courses = await tx.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, title: true },
  });
  const validCourseIds = new Set(courses.map((c) => c.id));
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const existing = await tx.enrollment.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true },
  });
  const alreadyEnrolled = new Set(existing.map((e) => e.courseId));

  const toCreate = courseIds.filter(
    (id) => validCourseIds.has(id) && !alreadyEnrolled.has(id),
  );
  const skipped = courseIds.filter((id) => alreadyEnrolled.has(id));
  const invalid = courseIds.filter((id) => !validCourseIds.has(id));

  const created: CreateEnrollmentsResult["created"] = [];
  for (const courseId of toCreate) {
    const enrollment = await tx.enrollment.create({
      data: { userId, courseId, enrolledById },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });
    created.push({
      id: enrollment.id,
      course: enrollment.course,
      user: enrollment.user,
      enrolledAt: enrollment.enrolledAt,
    });
  }

  if (toCreate.length > 0) {
    await tx.notification.createMany({
      data: toCreate.map((courseId) => ({
        userId,
        type: "enrollment",
        message: `You have been enrolled in "${courseTitleMap.get(courseId) ?? "a course"}"`,
        courseId,
      })),
    });
  }

  return { created, skipped, invalid, courseTitleMap };
}

/** Convenience wrapper that runs createEnrollments in a fresh transaction. */
export async function createEnrollmentsInTransaction(
  input: CreateEnrollmentsInput,
): Promise<CreateEnrollmentsResult> {
  return prisma.$transaction((tx) => createEnrollments(tx, input));
}

export interface CourseCompletionStats {
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  xpEarned: number;
  daysTaken: number;
}

/**
 * Compute stats for the course-completion modal. Reads directly from the DB
 * so the caller (the lesson-complete route) doesn't need to pass pre-fetched
 * data through.
 *
 * xpEarned is deterministic: lessonCount * 10 (lesson XP) + 100 (course bonus).
 * NOTE: a per-course XP ledger would be more accurate (accounts for re-attempts,
 * quiz bonuses, etc.) but is out of scope for this phase.
 */
export async function computeCourseCompletionStats(
  userId: string,
  courseId: string,
  enrolledAt: Date,
): Promise<CourseCompletionStats> {
  const [course, modules, completedCount] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    prisma.module.findMany({
      where: { courseId },
      include: { lessons: { select: { id: true } } },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        lesson: { module: { courseId } },
        completedAt: { not: null },
      },
    }),
  ]);

  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const totalLessons = allLessonIds.length;
  const now = new Date();
  const daysTaken = Math.max(
    1,
    Math.ceil((now.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24)),
  );
  // Deterministic XP: 10 per lesson + 100 course bonus
  const xpEarned = totalLessons * 10 + 100;

  return {
    courseTitle: course?.title ?? "this course",
    totalLessons,
    completedLessons: completedCount,
    xpEarned,
    daysTaken,
  };
}

export interface CourseCompletionResult {
  courseComplete: boolean;
  courseStats: CourseCompletionStats | null;
}

/**
 * Fire the course-completion side-effects exactly once per enrollment. Call
 * right after a lesson has transitioned incomplete→complete for this user.
 *
 * Checks whether every lesson in the course is now complete; if so, it
 * atomically stamps `enrollment.completedAt` via a conditional `updateMany`
 * (WHERE completedAt: null) so concurrent callers race safely — exactly one
 * wins the stamp. The winner awards the 100 XP course bonus, fires the
 * `course_completed` analytics event, and sends completion-alert emails to
 * subscribers. Everyone else gets `{courseComplete:false, courseStats:null}`.
 *
 * Best-effort: swallows its own errors so completion side-effects never fail
 * the caller's primary write. Extracted from the lesson-complete + quiz-attempt
 * routes (which were duplicate copies) and reused by the assessment marking
 * route.
 */
export async function maybeCompleteCourse(
  userId: string,
  courseId: string,
  enrollment: { id: string; completedAt: Date | null; enrolledAt: Date },
  now: Date,
): Promise<CourseCompletionResult> {
  try {
    const allModules = await prisma.module.findMany({
      where: { courseId },
      include: { lessons: { select: { id: true } } },
    });
    const allLessonIds = (allModules ?? []).flatMap((m) => m.lessons.map((l) => l.id));
    if (allLessonIds.length === 0) {
      return { courseComplete: false, courseStats: null };
    }

    const completedCount = await prisma.lessonProgress.count({
      where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
    });
    if (completedCount < allLessonIds.length) {
      return { courseComplete: false, courseStats: null };
    }

    // Conditional update: only flip completedAt if still null. Concurrent
    // requests racing past the count gate above all converge here; exactly
    // one wins so the side-effects fire exactly once.
    const stamp = await prisma.enrollment.updateMany({
      where: { id: enrollment.id, completedAt: null },
      data: { completedAt: now },
    });
    if (stamp.count !== 1) {
      return { courseComplete: false, courseStats: null };
    }

    await awardXp(userId, 100);

    const stats = await computeCourseCompletionStats(userId, courseId, enrollment.enrolledAt);
    trackEvent(userId, "course_completed", {
      courseId,
      xpEarned: stats.xpEarned,
      daysTaken: stats.daysTaken,
      lessonCount: stats.totalLessons,
    });

    const [subs, userData] = await Promise.all([
      prisma.courseEmailSubscription.findMany({ where: { courseId }, select: { email: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]);
    if (subs.length > 0) {
      sendCourseCompletionEmail(
        subs.map((s) => s.email),
        userData?.name ?? userData?.email ?? "A user",
        stats.courseTitle,
      ).catch((err) => console.error("[email] completion alert failed:", err));
    }

    return { courseComplete: true, courseStats: stats };
  } catch {
    // Course completion check is non-critical; never fail the caller's write.
    return { courseComplete: false, courseStats: null };
  }
}

/**
 * Fire the module-completion side-effects exactly once per (user, module). Call
 * right after a lesson in `moduleId` has transitioned incomplete→complete for
 * this user. This is the first-class achievement a scoped student earns
 * ("completed Module A") — independent of course completion.
 *
 * Checks whether every lesson in the module is now complete; if so, stamps a
 * `ModuleCompletion` row. The unique constraint on (userId, moduleId) makes
 * this idempotent and race-safe — exactly one concurrent caller wins the
 * `create`, the rest hit P2002 and no-op. The winner awards MODULE_COMPLETION_XP
 * and fires the `module_completed` analytics event.
 *
 * Best-effort: swallows its own errors so completion side-effects never fail
 * the caller's primary write.
 */
export async function maybeCompleteModule(
  userId: string,
  moduleId: string,
  now: Date,
): Promise<{ moduleComplete: boolean }> {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);
    if (lessonIds.length === 0) {
      return { moduleComplete: false };
    }

    const completedCount = await prisma.lessonProgress.count({
      where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
    });
    if (completedCount < lessonIds.length) {
      return { moduleComplete: false };
    }

    // Idempotent stamp: unique (userId, moduleId). Concurrent callers racing
    // past the count gate above converge here; exactly one wins the create so
    // the side-effects fire exactly once. Losers hit P2002 and no-op.
    try {
      await prisma.moduleCompletion.create({
        data: { userId, moduleId, completedAt: now },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return { moduleComplete: false };
      }
      throw err;
    }

    await awardXp(userId, MODULE_COMPLETION_XP);
    trackEvent(userId, "module_completed", {
      moduleId,
      xpEarned: MODULE_COMPLETION_XP,
    });

    return { moduleComplete: true };
  } catch {
    // Module completion check is non-critical; never fail the caller's write.
    return { moduleComplete: false };
  }
}
