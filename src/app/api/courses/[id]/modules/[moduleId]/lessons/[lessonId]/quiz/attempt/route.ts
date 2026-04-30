import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { sendCourseCompletionEmail } from "@/lib/email";
import { computeCourseCompletionStats } from "@/lib/enrollments";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

interface AnswerInput {
  questionId: string;
  selectedOptionId: string;
}

/** POST .../lessons/[lessonId]/quiz/attempt — submit a quiz attempt */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  // Non-admin users must be enrolled to submit quiz attempts
  const isPrivileged =
    session.user.role === "admin" || session.user.role === "course_manager";
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment && !isPrivileged) {
    return NextResponse.json(
      { error: "You are not enrolled in this course" },
      { status: 403 },
    );
  }

  // Verify lesson exists and belongs to the correct module/course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Parse passingScore
  let passingScore = 70;
  if (lesson.content) {
    try {
      const parsed = JSON.parse(lesson.content) as { passingScore?: number };
      if (typeof parsed.passingScore === "number") {
        passingScore = parsed.passingScore;
      }
    } catch {
      // use default
    }
  }

  // Parse body
  let body: { answers?: AnswerInput[] };
  try {
    body = (await request.json()) as { answers?: AnswerInput[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "answers array is required" }, { status: 400 });
  }

  // Fetch all questions for this lesson with options
  const questions = await prisma.quizQuestion.findMany({
    where: { lessonId },
    include: {
      options: true,
    },
    orderBy: { order: "asc" },
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "No questions found for this quiz" }, { status: 400 });
  }

  // Validate that all questions are answered
  const questionIds = new Set(questions.map((q) => q.id));
  const answeredQuestionIds = new Set(answers.map((a) => a.questionId));

  for (const qId of questionIds) {
    if (!answeredQuestionIds.has(qId)) {
      return NextResponse.json(
        { error: `Question ${qId} was not answered` },
        { status: 400 },
      );
    }
  }

  // Validate that each selectedOptionId belongs to the correct question
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  for (const answer of answers) {
    if (!questionIds.has(answer.questionId)) {
      return NextResponse.json(
        { error: `Question ${answer.questionId} does not belong to this quiz` },
        { status: 400 },
      );
    }
    const question = questionMap.get(answer.questionId)!;
    const optionBelongsToQuestion = question.options.some(
      (o) => o.id === answer.selectedOptionId,
    );
    if (!optionBelongsToQuestion) {
      return NextResponse.json(
        { error: `Option ${answer.selectedOptionId} does not belong to question ${answer.questionId}` },
        { status: 400 },
      );
    }
  }

  // Score the attempt. NOTE: per-question correctness is intentionally
  // **not** returned to the client. Revealing which questions were right
  // or wrong (let alone the correct option ID) lets a learner game the
  // retry flow — submit, see the answers, retry with full knowledge. We
  // only return the score summary; learners must actually study the
  // material to pass.
  let correctCount = 0;

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId)!;
    const correctOption = question.options.find((o) => o.isCorrect);
    const correctOptionId = correctOption?.id ?? "";
    if (answer.selectedOptionId === correctOptionId) correctCount++;
  }

  const totalQuestions = questions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = percentage >= passingScore;

  // ── Locked-enrollment short-circuit ───────────────────────────────────────
  // If the course is locked at completed, the learner can still take the quiz
  // for review/practice but nothing they do should mutate progress: no
  // QuizAttempt row, no QuizAnswer rows, no lessonProgress upsert, no XP.
  // The response still contains the per-answer breakdown so they see how
  // they did. UI shows a "Review mode — answers not recorded" banner.
  if (enrollment && enrollment.completedAt != null) {
    trackEvent(userId, "quiz_completed", {
      courseId,
      lessonId,
      score: correctCount,
      totalQuestions,
      percentage,
      passed,
      locked: true,
    });
    return NextResponse.json({
      score: correctCount,
      totalQuestions,
      percentage,
      passed,
      passingScore,
      xpAwarded: 0,
      newAchievements: [],
      courseComplete: false,
      courseStats: null,
      locked: true,
    });
  }

  // Save the attempt
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      lessonId,
      score: correctCount,
      totalQuestions,
      passed,
    },
  });

  // Save individual answers
  await prisma.quizAnswer.createMany({
    data: answers.map((a) => ({
      attemptId: attempt.id,
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
    })),
  });

  // If passed: auto-complete the lesson
  if (passed) {
    const now = new Date();
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, startedAt: now, completedAt: now },
      update: { completedAt: now },
    });
  }

  // Award XP and track event
  let xpAwarded = 0;
  let newAchievements: { key: string; title: string; icon: string }[] = [];
  if (passed) {
    const isPerfect = correctCount === totalQuestions;
    xpAwarded = isPerfect ? 50 : 25;
    const result = await awardXp(userId, xpAwarded);
    newAchievements = result.newAchievements.map((a) => ({
      key: a.key,
      title: a.title,
      icon: a.icon,
    }));
  }
  trackEvent(userId, "quiz_completed", {
    courseId,
    lessonId,
    score: correctCount,
    totalQuestions,
    percentage,
    passed,
  });

  // ── Course completion check ───────────────────────────────────────────────
  // Uses same firstCompletion invariant as the lesson-complete route: fires
  // exactly once per enrollment by checking enrollment.completedAt === null.
  let courseComplete = false;
  let courseStats: {
    courseTitle: string;
    totalLessons: number;
    completedLessons: number;
    xpEarned: number;
    daysTaken: number;
  } | null = null;

  if (passed && enrollment) {
    try {
      const allModules = await prisma.module.findMany({
        where: { courseId },
        include: { lessons: { select: { id: true } } },
      });
      const allLessonIds = allModules.flatMap((m) => m.lessons.map((l) => l.id));
      if (allLessonIds.length > 0) {
        const completedCount = await prisma.lessonProgress.count({
          where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
        });

        const firstCompletion = completedCount >= allLessonIds.length && enrollment.completedAt === null;

        if (firstCompletion) {
          const now = new Date();
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { completedAt: now },
          });

          await awardXp(userId, 100);

          const stats = await computeCourseCompletionStats(userId, courseId, enrollment.enrolledAt);
          trackEvent(userId, "course_completed", {
            courseId,
            xpEarned: stats.xpEarned,
            daysTaken: stats.daysTaken,
            lessonCount: stats.totalLessons,
          });

          const [subs, userData] = await Promise.all([
            prisma.courseEmailSubscription.findMany({ where: { courseId }, select: { email: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
          ]);
          if (subs.length > 0) {
            sendCourseCompletionEmail(
              subs.map((s) => s.email),
              userData?.name ?? userData?.email ?? "A user",
              stats.courseTitle,
            ).catch((err) => console.error("[email] completion alert failed:", err));
          }

          courseComplete = true;
          courseStats = stats;
        }
      }
    } catch {
      // Course completion check is non-critical
    }
  }

  return NextResponse.json({
    score: correctCount,
    totalQuestions,
    percentage,
    passed,
    passingScore,
    xpAwarded,
    newAchievements,
    courseComplete,
    courseStats,
  });
}
