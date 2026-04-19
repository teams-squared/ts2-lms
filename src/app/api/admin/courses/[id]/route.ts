import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/courses/[id] — permanently remove a course.
 *
 * All child data (modules, lessons, enrollments, progress, quiz attempts,
 * prerequisites, email subscriptions) cascades automatically via FK constraints.
 *
 * Guards:
 *  - Must be ADMIN or COURSE_MANAGER.
 *  - COURSE_MANAGER may only delete courses they authored.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, createdById: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (role !== "admin" && course.createdById !== userId) {
    return NextResponse.json(
      { error: "You can only delete courses you created" },
      { status: 403 },
    );
  }

  await prisma.course.delete({ where: { id: courseId } });

  trackEvent(userId, "course_deleted", {
    courseId,
    courseTitle: course.title,
    deletedBy: role,
  });

  return NextResponse.json({ deleted: true });
}
