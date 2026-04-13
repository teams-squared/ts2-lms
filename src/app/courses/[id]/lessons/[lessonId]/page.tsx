import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import { LessonViewer } from "@/components/courses/LessonViewer";
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
        <div className="max-w-3xl mx-auto px-6 py-8">
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

          <LessonViewer
            title={lesson.title}
            type={prismaLessonTypeToApp(lesson.type)}
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
        </div>
      </main>
    </div>
  );
}
