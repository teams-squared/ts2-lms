import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOpenSubmission } from "@/lib/assessment";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/**
 * POST .../lessons/[lessonId]/assessment/start
 *
 * Starts a new assessment attempt (or resumes an open one if the DB races).
 * Enrolled learners only; privileged users (admin/course_manager) must also
 * be enrolled — preview without enrollment is not supported here (unlike the
 * quiz attempt route which allows unrecorded preview). This keeps the
 * assessment submission flow simple: every attempt is real.
 *
 * Response:
 *   201 { submissionId: string, deadlineAt: string (ISO), serverNow: string (ISO) }
 *   400 { error: string }
 *   401 { error: "Unauthorized" }
 *   403 { error: string }
 *   404 { error: string }
 *   409 { error: "You already have an attempt in progress or awaiting marking" }
 */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;
  const isPrivileged =
    (session.user.role as Role) === "admin" ||
    (session.user.role as Role) === "course_manager";

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

  // Enrollment check: all users (including privileged) must be enrolled
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });

  if (!enrollment) {
    if (isPrivileged) {
      return NextResponse.json(
        { error: "You are not enrolled in this course. Enroll first to start an assessment." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "You are not enrolled in this course" },
      { status: 403 },
    );
  }

  // Load assessment config
  const config = await prisma.assessmentLesson.findUnique({
    where: { lessonId },
  });

  if (!config) {
    return NextResponse.json({ error: "Assessment not configured" }, { status: 404 });
  }

  // Reattempt lock: check for existing open submission
  const existing = await findOpenSubmission(userId, lessonId);
  if (existing) {
    return NextResponse.json(
      { error: "You already have an attempt in progress or awaiting marking" },
      { status: 409 },
    );
  }

  const now = new Date();
  const deadlineAt = new Date(now.getTime() + config.timeLimitMinutes * 60 * 1000);

  // Create submission; catch P2002 race (another request just created one)
  try {
    const submission = await prisma.assessmentSubmission.create({
      data: {
        userId,
        lessonId,
        startedAt: now,
        deadlineAt,
        status: "IN_PROGRESS",
        passThreshold: config.passThreshold,
        autoSubmitted: false,
      },
    });

    return NextResponse.json(
      {
        submissionId: submission.id,
        deadlineAt: submission.deadlineAt.toISOString(),
        serverNow: now.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    // P2002 = unique constraint violation (race: another request won)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      // Resume the existing open submission
      const open = await findOpenSubmission(userId, lessonId);
      if (open) {
        return NextResponse.json({
          submissionId: open.id,
          deadlineAt: open.deadlineAt.toISOString(),
          serverNow: new Date().toISOString(),
        });
      }
    }
    throw err;
  }
}
