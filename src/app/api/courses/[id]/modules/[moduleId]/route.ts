import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; moduleId: string }> };

/** PATCH /api/courses/[id]/modules/[moduleId] — update module. */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (session.user.role !== "admin" && course.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== courseId) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = (body.title as string)?.trim();
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    data.title = title;
  }

  const updated = await prisma.module.update({
    where: { id: moduleId },
    data,
  });

  return NextResponse.json(updated);
}

/** DELETE /api/courses/[id]/modules/[moduleId] — delete module. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (session.user.role !== "admin" && course.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== courseId) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  await prisma.module.delete({ where: { id: moduleId } });
  return NextResponse.json({ success: true });
}
