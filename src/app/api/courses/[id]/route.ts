import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, appStatusToPrisma } from "@/lib/types";
import { createNotificationsForCourse } from "@/lib/notifications";
import type { CourseStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/courses/[id] — single course detail. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Non-privileged users can only see published courses
  if (
    course.status !== "PUBLISHED" &&
    session.user.role !== "admin" &&
    course.createdById !== session.user.id
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail,
    status: prismaStatusToApp(course.status),
    createdBy: course.createdBy,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  });
}

/** PATCH /api/courses/[id] — update course (admin or course creator). */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only admin or the course creator can edit
  if (session.user.role !== "admin" && course.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = (body.title as string)?.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }
  if (body.thumbnail !== undefined) {
    data.thumbnail = body.thumbnail?.trim() || null;
  }
  if (body.status !== undefined) {
    const status = body.status as CourseStatus;
    if (!["draft", "published", "archived"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = appStatusToPrisma(status);
  }
  if (body.nodeId !== undefined) {
    data.nodeId = body.nodeId?.trim() || null;
  }

  const updated = await prisma.course.update({
    where: { id },
    data,
    include: { createdBy: { select: { name: true, email: true } } },
  });

  // Notify enrolled users when a course transitions to published
  if (data.status === "PUBLISHED" && course.status !== "PUBLISHED") {
    await createNotificationsForCourse(
      id,
      "course_published",
      `"${updated.title}" is now published and available.`
    );
  }

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    thumbnail: updated.thumbnail,
    status: prismaStatusToApp(updated.status),
    createdBy: updated.createdBy,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

/** DELETE /api/courses/[id] — delete course (admin only). */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.course.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
