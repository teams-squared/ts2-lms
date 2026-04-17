import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/enrollments/[id] — unenroll a user (admin/manager only).
 *  Deletes the Enrollment record but preserves LessonProgress and QuizAttempt data. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const enrollment = await prisma.enrollment.findUnique({ where: { id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  await prisma.enrollment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
