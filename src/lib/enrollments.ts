import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
