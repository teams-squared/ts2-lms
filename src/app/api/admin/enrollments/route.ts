import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";

/** GET /api/admin/enrollments — list all enrollments (admin/manager only) */
export async function GET() {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const enrollments = await prisma.enrollment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return NextResponse.json(enrollments);
}

/** POST /api/admin/enrollments — enroll a user in a course (admin/manager only) */
export async function POST(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: enrolledBy } = authResult;

  let body: { courseId?: string; userId?: string };
  try {
    body = (await request.json()) as { courseId?: string; userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { courseId, userId } = body;
  if (!courseId || !userId) {
    return NextResponse.json(
      { error: "courseId and userId are required" },
      { status: 400 },
    );
  }

  // Verify course exists
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already enrolled
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already enrolled in this course" },
      { status: 409 },
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: { userId, courseId, enrolledById: enrolledBy },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  // Send notification to the enrolled user
  await prisma.notification.create({
    data: {
      userId,
      type: "enrollment",
      message: `You have been enrolled in "${course.title}"`,
      courseId,
    },
  });

  // Award XP and track event
  const { newAchievements } = await awardXp(userId, 5);
  trackEvent(userId, "course_enrolled", { courseId, enrolledBy });

  return NextResponse.json(
    {
      ...enrollment,
      xpAwarded: 5,
      newAchievements: newAchievements.map((a) => ({
        key: a.key,
        title: a.title,
        icon: a.icon,
      })),
    },
    { status: 201 },
  );
}
