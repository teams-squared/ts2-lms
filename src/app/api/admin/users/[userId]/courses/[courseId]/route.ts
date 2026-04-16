import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ userId: string; courseId: string }> };

/** DELETE /api/admin/users/[userId]/courses/[courseId] — remove instructor course assignment */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId, courseId } = await params;

  const assignment = await prisma.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.courseInstructor.delete({
    where: { courseId_userId: { courseId, userId } },
  });

  return NextResponse.json({ deleted: true });
}
