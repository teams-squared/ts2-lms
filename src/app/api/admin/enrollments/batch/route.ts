import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { createEnrollments } from "@/lib/enrollments";

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

  // Create enrollments + notifications via shared helper
  const { created, skipped } = await prisma.$transaction((tx) =>
    createEnrollments(tx, {
      userId,
      courseIds,
      enrolledById: enrolledBy,
    }),
  );

  if (created.length === 0) {
    return NextResponse.json({ created: [], skipped, errors: [] });
  }

  // Award XP (5 per course) outside transaction for simplicity
  const totalXp = created.length * 5;
  const { newAchievements } = await awardXp(userId, totalXp);

  // Track events
  for (const c of created) {
    trackEvent(userId, "course_enrolled", {
      courseId: c.course.id,
      enrolledBy,
      batch: true,
    });
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
