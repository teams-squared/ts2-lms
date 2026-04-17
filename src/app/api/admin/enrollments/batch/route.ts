import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";

/** POST /api/admin/enrollments/batch — enroll a user in multiple courses at once */
export async function POST(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: enrolledBy } = authResult;

  let body: { userId?: string; courseIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, courseIds } = body;
  if (!userId || !courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json(
      { error: "userId and courseIds (non-empty array) are required" },
      { status: 400 },
    );
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify all courses exist
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, title: true },
  });
  const validCourseIds = new Set(courses.map((c) => c.id));
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  // Find already-enrolled courses to skip
  const existingEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true },
  });
  const alreadyEnrolled = new Set(existingEnrollments.map((e) => e.courseId));

  const toCreate = courseIds.filter((id) => validCourseIds.has(id) && !alreadyEnrolled.has(id));
  const skipped = courseIds.filter((id) => alreadyEnrolled.has(id));

  if (toCreate.length === 0) {
    return NextResponse.json({ created: [], skipped, errors: [] });
  }

  // Create enrollments + notifications in a transaction
  const created = await prisma.$transaction(async (tx) => {
    const enrollments = [];
    for (const courseId of toCreate) {
      const enrollment = await tx.enrollment.create({
        data: { userId, courseId, enrolledById: enrolledBy },
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } },
        },
      });
      enrollments.push(enrollment);
    }

    // Batch-create notifications
    await tx.notification.createMany({
      data: toCreate.map((courseId) => ({
        userId,
        type: "enrollment",
        message: `You have been enrolled in "${courseTitleMap.get(courseId) ?? "a course"}"`,
        courseId,
      })),
    });

    return enrollments;
  });

  // Award XP (5 per course) outside transaction for simplicity
  const totalXp = toCreate.length * 5;
  const { newAchievements } = await awardXp(userId, totalXp);

  // Track events
  for (const courseId of toCreate) {
    trackEvent(userId, "course_enrolled", { courseId, enrolledBy, batch: true });
  }

  return NextResponse.json(
    {
      created: created.map((e) => ({
        id: e.id,
        course: e.course,
        user: e.user,
        enrolledAt: e.enrolledAt.toISOString(),
      })),
      skipped,
      xpAwarded: totalXp,
      newAchievements: newAchievements.map((a) => ({
        key: a.key,
        title: a.title,
        icon: a.icon,
      })),
    },
    { status: 201 },
  );
}
