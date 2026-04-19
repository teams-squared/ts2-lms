import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/courses/[id]/modules — list modules with lessons. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const modules = await prisma.module.findMany({
    where: { courseId: id },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          order: true,
        },
      },
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(
    modules.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      courseId: m.courseId,
      lessons: m.lessons.map((l) => ({
        ...l,
        type: prismaLessonTypeToApp(l.type),
      })),
    }))
  );
}

/** POST /api/courses/[id]/modules — create a module. */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const allowed = await canManageCourse(session.user.id, session.user.role as Role, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = (body.title as string)?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Auto-assign next order
  const maxOrder = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (maxOrder?.order ?? 0) + 1;

  const created = await prisma.module.create({
    data: { title, order, courseId },
  });

  return NextResponse.json(created, { status: 201 });
}
