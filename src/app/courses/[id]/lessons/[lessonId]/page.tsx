import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import { checkCourseEligibility } from "@/lib/course-eligibility";
import type { Role } from "@/lib/types";
import { LessonViewer } from "@/components/courses/LessonViewer";
import { QuizViewer } from "@/components/courses/QuizViewer";
import { QuizBuilder } from "@/components/courses/QuizBuilder";
import { CourseSidebar } from "@/components/courses/CourseSidebar";
import { LessonCompleteButton } from "@/components/courses/LessonCompleteButton";
import { CheckCircleIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: courseId, lessonId } = await params;
  const userId = session.user!.id!;

  // Fetch lesson with its module + course info
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            select: { id: true, title: true, status: true, createdById: true },
          },
        },
      },
    },
  });

  if (!lesson) notFound();

  const course = lesson.module.course;

  // Non-privileged users can only view published course lessons
  if (
    course.status !== "PUBLISHED" &&
    session.user?.role !== "admin" &&
    course.createdById !== session.user?.id
  ) {
    notFound();
  }

  // Check eligibility — redirect to course page if locked
  const eligibility = await checkCourseEligibility(
    userId,
    (session.user?.role ?? "employee") as Role,
    courseId,
  );
  if (!eligibility.eligible) {
    redirect(`/courses/${courseId}`);
  }

  // Auto-enroll the user (idempotent) so progress tracking is available immediately
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });

  // Fetch all modules + lessons for the sidebar (and progress computation)
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, type: true, order: true },
      },
    },
    orderBy: { order: "asc" },
  });

  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  // Fetch progress records for this user across all course lessons
  const progressRecords = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: allLessonIds } },
  });

  const completedIds = new Set(
    progressRecords
      .filter((p) => p.completedAt !== null)
      .map((p) => p.lessonId),
  );

  const totalLessons = allLessonIds.length;
  const completedCount = completedIds.size;
  const percentComplete =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 1000) / 10;

  const isCurrentLessonCompleted = completedIds.has(lessonId);
  const isCourseComplete = totalLessons > 0 && completedCount === totalLessons;

  const sidebarModules = modules.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    lessons: m.lessons.map((l) => ({
      ...l,
      type: prismaLessonTypeToApp(l.type),
    })),
  }));

  const lessonType = prismaLessonTypeToApp(lesson.type);
  const isQuiz = lessonType === "quiz";
  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";

  // Fetch quiz data for quiz-type lessons
  let quizQuestions: {
    id: string;
    text: string;
    order: number;
    options: { id: string; text: string; isCorrect: boolean; order: number }[];
  }[] = [];
  let quizPassingScore = 70;
  let quizBestAttempt: {
    id: string;
    score: number;
    totalQuestions: number;
    passed: boolean;
    createdAt: string;
  } | null = null;

  if (isQuiz) {
    if (lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content) as { passingScore?: number };
        if (typeof parsed.passingScore === "number") {
          quizPassingScore = parsed.passingScore;
        }
      } catch {
        // use default
      }
    }

    quizQuestions = await prisma.quizQuestion.findMany({
      where: { lessonId },
      include: { options: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: "desc" },
    });

    if (attempts.length > 0) {
      const best = attempts.reduce((b, a) => (a.score > b.score ? a : b), attempts[0]);
      quizBestAttempt = {
        id: best.id,
        score: best.score,
        totalQuestions: best.totalQuestions,
        passed: best.passed,
        createdAt: best.createdAt.toISOString(),
      };
    }

    // For employees: omit isCorrect
    if (!isPrivileged) {
      quizQuestions = quizQuestions.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o, isCorrect: false })),
      }));
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <CourseSidebar
        modules={sidebarModules}
        courseId={courseId}
        currentLessonId={lessonId}
        courseTitle={course.title}
        completedLessonIds={completedIds}
        percentComplete={percentComplete}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Course complete banner */}
          {isCourseComplete && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Course complete!
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  You&apos;ve finished all {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} in this course.
                </p>
              </div>
            </div>
          )}

          {isQuiz ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {lesson.title}
              </h1>
              <QuizViewer
                questions={quizQuestions}
                passingScore={quizPassingScore}
                initialBestAttempt={quizBestAttempt}
                courseId={courseId}
                moduleId={lesson.moduleId}
                lessonId={lessonId}
              />
              {isCurrentLessonCompleted && (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Lesson complete — you passed this quiz.
                  </p>
                </div>
              )}
              {isPrivileged && (
                <QuizBuilder
                  initialQuestions={quizQuestions}
                  passingScore={quizPassingScore}
                  courseId={courseId}
                  moduleId={lesson.moduleId}
                  lessonId={lessonId}
                />
              )}
            </>
          ) : (
            <>
              <LessonViewer
                title={lesson.title}
                type={lessonType}
                content={lesson.content}
              />

              {/* Mark complete button */}
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-[#2e2e3a]">
                <LessonCompleteButton
                  courseId={courseId}
                  moduleId={lesson.moduleId}
                  lessonId={lessonId}
                  initialCompleted={isCurrentLessonCompleted}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
