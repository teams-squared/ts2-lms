import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";
import {
  satisfiesClearance,
  describeRequirements,
  loadUserTiers,
  type ClearanceRequirement,
  type UserTierMap,
} from "@/lib/clearance";

export interface EligibilityResult {
  eligible: boolean;
  missingPrerequisites: { id: string; title: string }[];
  /** True when the course carries clearance requirements the user fails. */
  clearanceLocked: boolean;
  /** Human-readable summary of the requirement(s), e.g.
   *  "Cybersecurity tier ≤2 or Finance tier ≤1". Null when not locked. */
  clearanceHint: string | null;
}

/** Shape of the clearance-requirement rows we select for hints. */
type ReqWithLabel = { sectorId: string; tier: number; sector: { label: string } };

const clearanceRequirementSelect = {
  select: { sectorId: true, tier: true, sector: { select: { label: true } } },
} as const;

function evalClearance(
  reqs: ReqWithLabel[],
  tiers: UserTierMap,
): { locked: boolean; hint: string | null } {
  const plain: ClearanceRequirement[] = reqs.map((r) => ({
    sectorId: r.sectorId,
    tier: r.tier,
  }));
  // Courses default OPEN when they carry no requirements (emptyDefault = true).
  const locked = !satisfiesClearance(plain, tiers, true);
  return { locked, hint: locked ? describeRequirements(reqs) : null };
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
    return { eligible: true, missingPrerequisites: [], clearanceLocked: false, clearanceHint: null };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      clearanceRequirements: clearanceRequirementSelect,
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
    return { eligible: false, missingPrerequisites: [], clearanceLocked: false, clearanceHint: null };
  }

  // Clearance — ANY-satisfies across the course's requirements.
  const tiers =
    course.clearanceRequirements.length > 0 ? await loadUserTiers(userId) : new Map<string, number>();
  const { locked: clearanceLocked, hint: clearanceHint } = evalClearance(
    course.clearanceRequirements,
    tiers,
  );

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
    eligible: !clearanceLocked && missingPrerequisites.length === 0,
    missingPrerequisites,
    clearanceLocked,
    clearanceHint,
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
      out.set(id, { eligible: true, missingPrerequisites: [], clearanceLocked: false, clearanceHint: null });
    }
    return out;
  }

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      clearanceRequirements: clearanceRequirementSelect,
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

  // Single-query fetch of all clearances user has + all prereq lessons
  const [tiers, prereqLessons] = await Promise.all([
    loadUserTiers(userId),
    prereqCourseIds.length > 0
      ? prisma.lesson.findMany({
          where: { module: { courseId: { in: prereqCourseIds } } },
          select: { id: true, module: { select: { courseId: true } } },
        })
      : Promise.resolve([] as { id: string; module: { courseId: string } }[]),
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
  const completedSet = new Set(completedRecords.map((r) => r.lessonId));

  for (const courseId of courseIds) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
      out.set(courseId, { eligible: false, missingPrerequisites: [], clearanceLocked: false, clearanceHint: null });
      continue;
    }

    const { locked: clearanceLocked, hint: clearanceHint } = evalClearance(
      course.clearanceRequirements,
      tiers,
    );

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
      eligible: !clearanceLocked && missingPrerequisites.length === 0,
      missingPrerequisites,
      clearanceLocked,
      clearanceHint,
    });
  }

  return out;
}
