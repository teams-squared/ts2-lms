import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp, appLessonTypeToPrisma } from "@/lib/types";
import { canManageCourse } from "@/lib/courseAccess";
import type { LessonType, Role } from "@/lib/types";

type Params = {
  params: Promise<{ id: string; moduleId: string; lessonId: string }>;
};

/** GET /api/courses/[id]/modules/[moduleId]/lessons/[lessonId] — lesson detail. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    type: prismaLessonTypeToApp(lesson.type),
    content: lesson.content,
    order: lesson.order,
    deadlineDays: lesson.deadlineDays,
    moduleId: lesson.moduleId,
    courseId: lesson.module.courseId,
  });
}

/** PATCH /api/courses/[id]/modules/[moduleId]/lessons/[lessonId] — update lesson. */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, lessonId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = (body.title as string)?.trim();
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    data.title = title;
  }
  if (body.content !== undefined) {
    data.content = body.content?.trim() || null;
  }
  if (body.type !== undefined) {
    const type = body.type as LessonType;
    if (!["text", "video", "quiz", "document", "html", "policy_doc"].includes(type)) {
      return NextResponse.json({ error: "Invalid lesson type" }, { status: 400 });
    }
    if ((type === "document" || type === "html") && body.content) {
      try {
        const ref = JSON.parse(body.content);
        if (!ref.driveId || !ref.itemId || !ref.fileName || !ref.mimeType) {
          return NextResponse.json({ error: "Invalid document reference" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid document reference JSON" }, { status: 400 });
      }
    }
    data.type = appLessonTypeToPrisma(type);
  }
  if (body.deadlineDays !== undefined) {
    if (body.deadlineDays === null) {
      data.deadlineDays = null;
    } else {
      const days = Number(body.deadlineDays);
      if (!Number.isInteger(days) || days < 1) {
        return NextResponse.json({ error: "deadlineDays must be a positive integer" }, { status: 400 });
      }
      data.deadlineDays = days;
    }
  }

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data,
  });

  return NextResponse.json({
    ...updated,
    type: prismaLessonTypeToApp(updated.type),
  });
}

/** DELETE /api/courses/[id]/modules/[moduleId]/lessons/[lessonId] — delete lesson. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, lessonId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.lesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ success: true });
}
