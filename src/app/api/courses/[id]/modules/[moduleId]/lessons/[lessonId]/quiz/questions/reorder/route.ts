import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/** POST .../quiz/questions/reorder — reorder all questions for a lesson */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPrivileged = session.user.role === "admin" || session.user.role === "manager";
  if (!isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: courseId, moduleId, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  let body: { orderedIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
  }

  // Verify all IDs belong to this lesson
  const existing = await prisma.quizQuestion.findMany({
    where: { lessonId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));

  if (
    body.orderedIds.length !== existingIds.size ||
    body.orderedIds.some((id) => !existingIds.has(id))
  ) {
    return NextResponse.json({ error: "orderedIds must match existing question IDs exactly" }, { status: 400 });
  }

  // Update order for each question in a transaction
  await prisma.$transaction(
    body.orderedIds.map((id, idx) =>
      prisma.quizQuestion.update({ where: { id }, data: { order: idx + 1 } })
    )
  );

  const updated = await prisma.quizQuestion.findMany({
    where: { lessonId },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(updated);
}
