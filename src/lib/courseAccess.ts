import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

/**
 * Returns true if the given user is allowed to manage (edit) the given course.
 * - Admin: always
 * - Manager: only courses they created
 * - Instructor: only courses they're explicitly assigned to via CourseInstructor
 * - Employee: never
 */
export async function canManageCourse(
  userId: string,
  role: Role,
  courseId: string,
): Promise<boolean> {
  if (role === "admin") return true;

  if (role === "manager") {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    });
    return course?.createdById === userId;
  }

  if (role === "instructor") {
    const assignment = await prisma.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });
    return !!assignment;
  }

  return false;
}

/**
 * Returns true if the given user is allowed to view the given course
 * regardless of its publish status or enrollment.
 * Currently delegates to canManageCourse (anyone who can manage can view).
 * Separated to allow future divergence (e.g. view-only access).
 */
export async function canViewCourse(
  userId: string,
  role: Role,
  courseId: string,
): Promise<boolean> {
  return canManageCourse(userId, role, courseId);
}
