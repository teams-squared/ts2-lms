import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * DELETE /api/admin/courses/[id]/managers/[userId] — unlink a user from the
 * course's managers. Admin-only. Idempotent — succeeds even if the link
 * does not exist.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: actorId } = authResult;

  const { id: courseId, userId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { managers: { disconnect: { id: userId } } },
  });

  trackEvent(actorId, "course_manager_unassigned", {
    courseId,
    courseTitle: course.title,
    managerId: userId,
  });

  return NextResponse.json({ removed: true });
}
