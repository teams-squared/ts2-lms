import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = {
  params: Promise<{ id: string; moduleId: string; lessonId: string; variantId: string }>;
};

/**
 * PATCH .../assessment/variants/[variantId]
 *
 * Rename an assessment variant. Admin/course_manager only.
 *
 * Request body: { label: string }
 *
 * Response:
 *   200 { id, label, order }
 *   400 { error: string }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId, variantId } = await params;

  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  if (lesson.type !== "ASSESSMENT") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const variant = await prisma.assessmentVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant || variant.lessonId !== lessonId) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  let body: { label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { label } = body;

  if (!label || typeof label !== "string" || label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const updated = await prisma.assessmentVariant.update({
    where: { id: variantId },
    data: { label: label.trim() },
    select: {
      id: true,
      label: true,
      order: true,
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE .../assessment/variants/[variantId]
 *
 * Delete an assessment variant (cascade removes its questions).
 * Returns 409 if the variant has any student submissions.
 * Admin/course_manager only.
 *
 * Response:
 *   200 { deleted: true }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: string }
 *   409 { error: string }
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId, variantId } = await params;

  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  if (lesson.type !== "ASSESSMENT") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const variant = await prisma.assessmentVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant || variant.lessonId !== lessonId) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  // Block deletion if students have already been assigned this variant
  const submissionCount = await prisma.assessmentSubmission.count({
    where: { variantId },
  });

  if (submissionCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a variant that students have already been assigned" },
      { status: 409 },
    );
  }

  await prisma.assessmentVariant.delete({ where: { id: variantId } });

  return NextResponse.json({ deleted: true });
}
