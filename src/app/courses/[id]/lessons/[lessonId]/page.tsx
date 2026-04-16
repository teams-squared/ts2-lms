import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import type { Role } from "@/lib/types";
import { canViewCourse } from "@/lib/courseAccess";

import { LessonViewer } from "@/components/courses/LessonViewer";
import { QuizViewer } from "@/components/courses/QuizViewer";
import { QuizBuilder } from "@/components/courses/QuizBuilder";
import { CourseSidebar } from "@/components/courses/CourseSidebar";
import { LessonCompleteButton } from "@/components/courses/LessonCompleteButton";
import { CheckCircleIcon, ClockIcon, AlertTriangleIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LessonNavigation } from "@/components/courses/LessonNavigation";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineInfo } from "@/lib/deadlines";

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

  // Check if user has privileged access (admin, manager-creator, assigned instructor)
  const role = session.user?.role as Role;
  const isPrivilegedUser = await canViewCourse(userId, role, courseId);

  // Non-privileged users can only view published course lessons
  if (course.status !== "PUBLISHED" && !isPrivilegedUser) {
    notFound();
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment && !isPrivilegedUser) {
    redirect("/courses");
  }

  // Fetch all modules + lessons for the sidebar (and progress computation)
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, type: true, order: true, deadlineDays: true },
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

  // Compute deadline info for all lessons (for sidebar indicators)
  const allLessonsFlat2 = modules.flatMap((m) => m.lessons);
  const deadlineInfoMap: Record<string, DeadlineInfo> = {};
  if (enrollment) {
    for (const l of allLessonsFlat2) {
      if (l.deadlineDays != null) {
        const completedAt = completedIds.has(l.id) ? new Date() : null;
        deadlineInfoMap[l.id] = {
          deadlineDays: l.deadlineDays,
          absoluteDeadline: computeDeadline(enrollment.enrolledAt, l.deadlineDays).toISOString(),
          status: getDeadlineStatus(enrollment.enrolledAt, l.deadlineDays, completedAt),
        };
      }
    }
  }

  // Current lesson deadline info for the banner
  const currentDeadlineInfo = deadlineInfoMap[lessonId] ?? null;
  const showDeadlineBanner =
    currentDeadlineInfo &&
    !isCurrentLessonCompleted &&
    (currentDeadlineInfo.status === "due-soon" || currentDeadlineInfo.status === "overdue");

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
  const isDocument = lessonType === "document";
  const isPrivileged = isPrivilegedUser;

  // Compute next lesson URL for quiz "Continue" CTA and lesson navigation
  const allLessonsFlat = sidebarModules.flatMap((m) => m.lessons);
  const currentLessonIdx = allLessonsFlat.findIndex((l) => l.id === lessonId);
  const nextLesson =
    currentLessonIdx >= 0 && currentLessonIdx < allLessonsFlat.length - 1
      ? allLessonsFlat[currentLessonIdx + 1]
      : null;
  const nextLessonUrl = nextLesson ? `/courses/${courseId}/lessons/${nextLesson.id}` : null;

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
        deadlineInfoMap={deadlineInfoMap}
      />

      <main className="flex-1 overflow-y-auto">
        <div className={`${isDocument ? "max-w-5xl" : "max-w-3xl"} mx-auto px-4 sm:px-6 py-8`}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Courses", href: "/courses" },
              { label: course.title, href: `/courses/${courseId}` },
              { label: lesson.title },
            ]}
          />

          {/* Deadline warning banner */}
          {showDeadlineBanner && currentDeadlineInfo && (
            <div className={`mb-6 flex items-center gap-3 rounded-xl border px-5 py-4 ${
              currentDeadlineInfo.status === "overdue"
                ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20"
                : "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20"
            }`}>
              {currentDeadlineInfo.status === "overdue" ? (
                <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              ) : (
                <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                currentDeadlineInfo.status === "overdue"
                  ? "text-red-800 dark:text-red-200"
                  : "text-amber-800 dark:text-amber-200"
              }`}>
                {formatDeadlineRelative(new Date(currentDeadlineInfo.absoluteDeadline!))}
              </p>
            </div>
          )}

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
                nextLessonUrl={nextLessonUrl}
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
              <LessonNavigation
                courseId={courseId}
                currentLessonId={lessonId}
                modules={sidebarModules}
              />
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
              <LessonNavigation
                courseId={courseId}
                currentLessonId={lessonId}
                modules={sidebarModules}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
