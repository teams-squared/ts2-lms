import { prisma } from "@/lib/prisma";

/**
 * Creates a notification for every user enrolled in a course.
 * Safe to call with an empty enrollment list — createMany with [] is a no-op.
 */
export async function createNotificationsForCourse(
  courseId: string,
  type: string,
  message: string
): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { userId: true },
  });

  if (enrollments.length === 0) return;

  await prisma.notification.createMany({
    data: enrollments.map((e) => ({
      userId: e.userId,
      type,
      message,
      courseId,
    })),
    skipDuplicates: true,
  });
}
