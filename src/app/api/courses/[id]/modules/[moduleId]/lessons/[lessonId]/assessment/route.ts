import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewLesson } from "@/lib/courseAccess";
import { loadSanitizedQuestions, getStudentState } from "@/lib/assessment";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/**
 * GET .../lessons/[lessonId]/assessment
 *
 * Response:
 *   200 {
 *     config: { timeLimitMinutes: number, passThreshold: number } | null,
 *     questions: SanitizedAssessmentQuestion[],
 *     state: AssessmentStudentState,
 *   }
 *   401 { error: "Unauthorized" }
 *   403 { error: "Forbidden" }
 *   404 { error: "Lesson not found" }
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  // Verify lesson belongs to correct module/course and is type ASSESSMENT
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

  if (!(await canViewLesson(userId, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load assessment config (may be null if not set up yet)
  const assessmentConfig = await prisma.assessmentLesson.findUnique({
    where: { lessonId },
    select: { timeLimitMinutes: true, passThreshold: true },
  });

  if (!assessmentConfig) {
    return NextResponse.json({
      config: null,
      questions: [],
      state: { phase: "startable" },
    });
  }

  const [questions, state] = await Promise.all([
    loadSanitizedQuestions(lessonId),
    getStudentState(userId, lessonId),
  ]);

  return NextResponse.json({
    config: {
      timeLimitMinutes: assessmentConfig.timeLimitMinutes,
      passThreshold: assessmentConfig.passThreshold,
    },
    questions,
    state,
  });
}
