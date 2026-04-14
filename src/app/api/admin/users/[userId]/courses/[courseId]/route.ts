import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ userId: string; courseId: string }> };

/** DELETE /api/admin/users/[userId]/courses/[courseId] — remove instructor course assignment */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
