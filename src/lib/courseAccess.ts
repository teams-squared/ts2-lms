import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

/**
 * True if the user is allowed to manage (edit, delete, mutate sub-resources)
 * the given course.
 *
 *  - admin            → always true
 *  - course_manager   → true iff linked to the course via the
 *                       CourseManagers m2m relation
 *  - everyone else    → false
 */
export async function canManageCourse(
  userId: string,
  role: Role,
  courseId: string,
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "course_manager") return false;
  const match = await prisma.course.findFirst({
    where: { id: courseId, managers: { some: { id: userId } } },
    select: { id: true },
  });
  return match !== null;
}

/**
 * "Privileged" relative to a course — used by learner-facing pages to bypass
 * the enrollment / published-status gate. Same shape as canManageCourse.
 */
export async function canViewCourse(
  userId: string,
  role: Role,
  courseId: string,
): Promise<boolean> {
  return canManageCourse(userId, role, courseId);
}

/**
 * Returns the set of course IDs the caller can manage.
 *
 *  - admin            → null  (sentinel meaning "all courses, no filter")
 *  - course_manager   → array of managed course IDs (possibly empty)
 *  - everyone else    → empty array
 *
 * Use null-vs-array to drive Prisma `where: managedIds === null ? {} : { id: { in: managedIds } }`.
 */
export async function listManagedCourseIds(
  userId: string,
  role: Role,
): Promise<string[] | null> {
  if (role === "admin") return null;
  if (role !== "course_manager") return [];
  const courses = await prisma.course.findMany({
    where: { managers: { some: { id: userId } } },
    select: { id: true },
  });
  return courses.map((c) => c.id);
}
