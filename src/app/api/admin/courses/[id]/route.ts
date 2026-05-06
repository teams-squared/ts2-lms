import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse } from "@/lib/courseAccess";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/courses/[id] — permanently remove a course.
 *
 * All child data (modules, lessons, enrollments, progress, quiz attempts,
 * prerequisites, email subscriptions) cascades automatically via FK constraints.
 *
 * Guards:
 *  - Must be ADMIN or a COURSE_MANAGER linked to the course via the
 *    CourseManagers m2m relation.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const allowed = await canManageCourse(userId, role, courseId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only delete courses you manage" },
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
