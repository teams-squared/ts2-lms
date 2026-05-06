import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/courses/[id]/managers — list managers linked to the course.
 * Admin-only.
 */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { id: courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      managers: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(course.managers);
}

/**
 * POST /api/admin/courses/[id]/managers — link a user to the course as a
 * manager. Body: { userId }. Admin-only. The target user must have role
 * COURSE_MANAGER (or ADMIN — admins can also be explicit managers, useful
 * if a course is later expected to be co-managed before role demotion).
 */
export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: actorId } = authResult;

  const { id: courseId } = await params;

  let body: { userId?: string };
  try {
    body = (await request.json()) as { userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "COURSE_MANAGER" && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only users with role admin or course_manager can be assigned as managers" },
      { status: 400 },
    );
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { managers: { connect: { id: userId } } },
  });

  trackEvent(actorId, "course_manager_assigned", {
    courseId,
    courseTitle: course.title,
    managerId: userId,
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}
