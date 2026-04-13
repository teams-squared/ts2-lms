import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string; moduleId: string; lessonId: string; questionId: string }>;
};

/** DELETE .../quiz/questions/[questionId] — remove a question (admin/manager only) */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPrivileged = session.user.role === "admin" || session.user.role === "manager";
  if (!isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: courseId, moduleId, lessonId, questionId } = await params;

  // Verify lesson exists and belongs to the correct module/course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Verify question belongs to this lesson
  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question || question.lessonId !== lessonId) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  await prisma.quizQuestion.delete({ where: { id: questionId } });

  return NextResponse.json({ deleted: true });
}
