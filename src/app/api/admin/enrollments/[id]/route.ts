import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse } from "@/lib/courseAccess";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/enrollments/[id] — unenroll a user.
 *  Deletes the Enrollment row but preserves LessonProgress and QuizAttempt data.
 *  Course managers may only unenroll users from courses they manage. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { id } = await params;

  const enrollment = await prisma.enrollment.findUnique({ where: { id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const allowed = await canManageCourse(userId, role, enrollment.courseId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only unenroll users from courses you manage" },
      { status: 403 },
    );
  }

  await prisma.enrollment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
