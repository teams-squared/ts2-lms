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
  for (const { prerequisite } of course.prerequisites) {
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
