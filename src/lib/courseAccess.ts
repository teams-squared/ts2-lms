import type { Role } from "@/lib/types";

export async function canManageCourse(
  _userId: string,
  role: Role,
  _courseId: string,
): Promise<boolean> {
  return role === "admin" || role === "course_manager";
}

export async function canViewCourse(
  userId: string,
  role: Role,
  courseId: string,
): Promise<boolean> {
  return canManageCourse(userId, role, courseId);
}
