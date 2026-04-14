import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId]/courses — list instructor course assignments */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const assignments = await prisma.courseInstructor.findMany({
    where: { userId },
    select: {
      assignedAt: true,
      course: { select: { id: true, title: true, status: true } },
    },
    orderBy: { assignedAt: "asc" },
  });

  return NextResponse.json(assignments.map((a) => ({ ...a.course, assignedAt: a.assignedAt })));
}

/** POST /api/admin/users/[userId]/courses — assign a course to an instructor */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "User must be an instructor to assign courses" }, { status: 400 });
  }

  let body: { courseId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true, title: true, status: true } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const assignment = await prisma.courseInstructor.upsert({
    where: { courseId_userId: { courseId: body.courseId, userId } },
    create: { courseId: body.courseId, userId },
    update: {},
  });

  return NextResponse.json({ ...course, assignedAt: assignment.assignedAt }, { status: 201 });
}
