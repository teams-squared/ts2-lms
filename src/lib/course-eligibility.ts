import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

export interface EligibilityResult {
  eligible: boolean;
  missingPrerequisites: { id: string; title: string }[];
  missingClearance: string | null;
}

/**
 * Check whether a user meets the requirements to enroll in a course.
 * Admins bypass all checks.
 */
export async function checkCourseEligibility(
  userId: string,
  role: Role,
  courseId: string,
): Promise<EligibilityResult> {
  if (role === "admin") {
    return { eligible: true, missingPrerequisites: [], missingClearance: null };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      requiredClearance: true,
      prerequisites: {
        select: {
          prerequisite: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!course) {
    return { eligible: false, missingPrerequisites: [], missingClearance: null };
  }

  // Check clearance requirement
  let missingClearance: string | null = null;
  if (course.requiredClearance) {
    const clearance = await prisma.userClearance.findUnique({
      where: {
        userId_clearance: {
          userId,
          clearance: course.requiredClearance,
        },
      },
    });
    if (!clearance) {
      missingClearance = course.requiredClearance;
    }
  }

  // Check prerequisite completion
  const missingPrerequisites: { id: string; title: string }[] = [];
  for (const { prerequisite } of course.prerequisites ?? []) {
    const completed = await isCourseCompleted(userId, prerequisite.id);
    if (!completed) {
      missingPrerequisites.push({
        id: prerequisite.id,
        title: prerequisite.title,
      });
    }
  }

  return {
    eligible: missingClearance === null && missingPrerequisites.length === 0,
    missingPrerequisites,
    missingClearance,
  };
}

/**
 * Returns true if the user has completed ALL lessons in a course
 * (every lesson has a LessonProgress with completedAt set).
 */
async function isCourseCompleted(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });

  if (lessons.length === 0) return false;

  const completedCount = await prisma.lessonProgress.count({
    where: {
      userId,
      lessonId: { in: lessons.map((l) => l.id) },
      completedAt: { not: null },
    },
  });

  return completedCount >= lessons.length;
}

/**
 * Batched eligibility check for many courses at once. Replaces N × checkCourseEligibility
 * calls (each doing 2–4 queries) with a constant number of queries regardless of N.
 *
 * Queries: courses-with-reqs (1) + user clearances (1) + lessons-in-prereq-courses (1) +
 * completed progress for those lessons (1) = 4 round-trips total.
 */
export async function checkCourseEligibilityBatch(
  userId: string,
  role: Role,
  courseIds: string[],
): Promise<Map<string, EligibilityResult>> {
  const out = new Map<string, EligibilityResult>();
  if (courseIds.length === 0) return out;

  if (role === "admin") {
    for (const id of courseIds) {
      out.set(id, { eligible: true, missingPrerequisites: [], missingClearance: null });
    }
    return out;
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      requiredClearance: true,
      prerequisites: {
        select: { prerequisite: { select: { id: true, title: true } } },
      },
    },
  });

  // All prerequisite course IDs across the batch (deduped)
  const prereqCourseIds = [
    ...new Set(
      courses.flatMap((c) => c.prerequisites.map((p) => p.prerequisite.id)),
    ),
  ];

  // Single-query fetch of all clearances user has + all prereq lessons + all completion records
  const [userClearances, prereqLessons, completed] = await Promise.all([
    prisma.userClearance.findMany({
      where: { userId },
      select: { clearance: true },
    }),
    prereqCourseIds.length > 0
      ? prisma.lesson.findMany({
          where: { module: { courseId: { in: prereqCourseIds } } },
          select: { id: true, module: { select: { courseId: true } } },
        })
      : Promise.resolve([] as { id: string; module: { courseId: string } }[]),
    // Placeholder — resolved after lessonIds known
    Promise.resolve(null as unknown as Array<{ lessonId: string }>),
  ]);

  const lessonsByPrereq = new Map<string, string[]>();
  for (const l of prereqLessons) {
    const arr = lessonsByPrereq.get(l.module.courseId);
    if (arr) arr.push(l.id);
    else lessonsByPrereq.set(l.module.courseId, [l.id]);
  }
  const allLessonIds = prereqLessons.map((l) => l.id);
  const completedRecords =
    allLessonIds.length > 0
      ? await prisma.lessonProgress.findMany({
          where: {
            userId,
            lessonId: { in: allLessonIds },
            completedAt: { not: null },
          },
          select: { lessonId: true },
        })
      : [];
  void completed;
  const completedSet = new Set(completedRecords.map((r) => r.lessonId));
  const clearanceSet = new Set(userClearances.map((c) => c.clearance));

  for (const courseId of courseIds) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
      out.set(courseId, { eligible: false, missingPrerequisites: [], missingClearance: null });
      continue;
    }

    let missingClearance: string | null = null;
    if (course.requiredClearance && !clearanceSet.has(course.requiredClearance)) {
      missingClearance = course.requiredClearance;
    }

    const missingPrerequisites: { id: string; title: string }[] = [];
    for (const { prerequisite } of course.prerequisites) {
      const lessonIds = lessonsByPrereq.get(prerequisite.id) ?? [];
      if (lessonIds.length === 0) {
        // Empty prereq course — treat as not completed
        missingPrerequisites.push(prerequisite);
        continue;
      }
      const allDone = lessonIds.every((id) => completedSet.has(id));
      if (!allDone) missingPrerequisites.push(prerequisite);
    }

    out.set(courseId, {
      eligible: missingClearance === null && missingPrerequisites.length === 0,
      missingPrerequisites,
      missingClearance,
    });
  }

  return out;
}
