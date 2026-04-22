import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appLessonTypeToPrisma, prismaLessonTypeToApp } from "@/lib/types";
import { createNotificationsForCourse } from "@/lib/notifications";
import { canManageCourse } from "@/lib/courseAccess";
import type { LessonType, Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string }> };

/** POST /api/courses/[id]/modules/[moduleId]/lessons — create a lesson. */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== courseId) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const body = await request.json();
  const title = (body.title as string)?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const type: LessonType = body.type || "text";
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

  const maxOrder = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  // Validate optional deadlineDays
  let deadlineDays: number | null = null;
  if (body.deadlineDays !== undefined && body.deadlineDays !== null) {
    deadlineDays = Number(body.deadlineDays);
    if (!Number.isInteger(deadlineDays) || deadlineDays < 1) {
      return NextResponse.json({ error: "deadlineDays must be a positive integer" }, { status: 400 });
    }
  }

  const lesson = await prisma.lesson.create({
    data: {
      title,
      type: appLessonTypeToPrisma(type),
      content: body.content?.trim() || null,
      order: (maxOrder?.order ?? 0) + 1,
      deadlineDays,
      moduleId,
    },
  });

  // Notify enrolled users when a lesson is added to an already-published course
  if (course.status === "PUBLISHED") {
    await createNotificationsForCourse(
      courseId,
      "new_lesson",
      `A new lesson "${title}" has been added to "${course.title}".`
    );
  }

  return NextResponse.json(
    { ...lesson, type: prismaLessonTypeToApp(lesson.type) },
    { status: 201 }
  );
}
