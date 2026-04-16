import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/enrollments/[id] — unenroll a user (admin/manager only).
 *  Deletes the Enrollment record but preserves LessonProgress and QuizAttempt data. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isPrivileged =
    session.user.role === "admin" || session.user.role === "manager";
  if (!isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const enrollment = await prisma.enrollment.findUnique({ where: { id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  await prisma.enrollment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
