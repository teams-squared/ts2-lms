import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { checkCourseEligibility } from "@/lib/course-eligibility";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** POST /api/courses/[id]/enroll — enroll the current user in a course (idempotent). */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Employees can only enroll in published courses; admins and creators can enroll in any status
  if (
    course.status !== "PUBLISHED" &&
    session.user.role !== "admin" &&
    course.createdById !== session.user.id
  ) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Check prerequisite and clearance eligibility
  const eligibility = await checkCourseEligibility(
    session.user.id,
    session.user.role as Role,
    courseId,
  );
  if (!eligibility.eligible) {
    return NextResponse.json(
      {
        error: "You do not meet the requirements for this course",
        missingPrerequisites: eligibility.missingPrerequisites,
        missingClearance: eligibility.missingClearance,
      },
      { status: 403 },
    );
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    create: { userId: session.user.id, courseId },
    update: {},
  });

  // Award XP and track event
  const { newAchievements } = await awardXp(session.user.id, 5);
  trackEvent(session.user.id, "course_enrolled", { courseId });

  return NextResponse.json({
    enrolled: true,
    enrolledAt: enrollment.enrolledAt,
    xpAwarded: 5,
    newAchievements: newAchievements.map((a) => ({
      key: a.key,
      title: a.title,
      icon: a.icon,
    })),
  });
}
