import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

/** GET /api/admin/assignments — list all assignments (admin/manager only) */
export async function GET() {
  const authResult = await requireRole("manager");
  if (authResult instanceof NextResponse) return authResult;

  const assignments = await prisma.assignment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
      assignedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json(assignments);
}

/** POST /api/admin/assignments — assign course(s) to user(s) (admin/manager only) */
export async function POST(request: Request) {
  const authResult = await requireRole("manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: assignedById } = authResult;

  let body: { courseId?: string; userId?: string };
  try {
    body = (await request.json()) as { courseId?: string; userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { courseId, userId } = body;
  if (!courseId || !userId) {
    return NextResponse.json(
      { error: "courseId and userId are required" },
      { status: 400 },
    );
  }

  // Verify course exists
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already assigned
  const existing = await prisma.assignment.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Course is already assigned to this user" },
      { status: 409 },
    );
  }

  const assignment = await prisma.assignment.create({
    data: {
      courseId,
      userId,
      assignedById,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  // Create notification for the assigned user
  await prisma.notification.create({
    data: {
      userId,
      type: "assignment",
      message: `You have been assigned the course "${course.title}"`,
      courseId,
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}
