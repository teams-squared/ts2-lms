import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineInfo } from "@/lib/deadlines";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ModuleList } from "@/components/courses/ModuleList";
import { GraduationCapIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EnrollButton } from "@/components/courses/EnrollButton";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const userId = session.user!.id!;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, type: true, order: true, deadlineDays: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";

  // Non-privileged users can only see published courses
  if (
    course.status !== "PUBLISHED" &&
    session.user?.role !== "admin" &&
    course.createdById !== session.user?.id
  ) {
    notFound();
  }

  // Fetch enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: id } },
  });

  // Non-privileged users must be enrolled to view the course
  if (!enrollment && !isPrivileged) {
    notFound();
  }

  const allLessonsFlat = course.modules.flatMap((m) => m.lessons);
  const allLessonIds = allLessonsFlat.map((l) => l.id);
  const totalLessons = allLessonIds.length;

  let completedLessons = 0;
  let percentComplete = 0;
  let completedLessonIdSet = new Set<string>();

  if (enrollment && totalLessons > 0) {
    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
    });
    completedLessons = progressRecords.length;
    percentComplete = Math.round((completedLessons / totalLessons) * 1000) / 10;
    completedLessonIdSet = new Set(progressRecords.map((p) => p.lessonId));
  }

  // Compute lesson navigation URLs for the CTA
  const firstLessonId = allLessonsFlat[0]?.id ?? null;
  const firstLessonUrl = firstLessonId ? `/courses/${id}/lessons/${firstLessonId}` : null;
  const firstIncompleteLessonId =
    allLessonsFlat.find((l) => !completedLessonIdSet.has(l.id))?.id ?? null;
  const continueUrl = firstIncompleteLessonId
    ? `/courses/${id}/lessons/${firstIncompleteLessonId}`
    : firstLessonUrl;
  const isCourseComplete = totalLessons > 0 && completedLessons === totalLessons;

  // Compute deadline info for each lesson (when enrolled)
  const deadlineInfoMap = new Map<string, DeadlineInfo>();
  if (enrollment) {
    for (const lesson of allLessonsFlat) {
      if (lesson.deadlineDays != null) {
        const completedAt = completedLessonIdSet.has(lesson.id) ? new Date() : null;
        deadlineInfoMap.set(lesson.id, {
          deadlineDays: lesson.deadlineDays,
          absoluteDeadline: computeDeadline(enrollment.enrolledAt, lesson.deadlineDays).toISOString(),
          status: getDeadlineStatus(enrollment.enrolledAt, lesson.deadlineDays, completedAt),
        });
      }
    }
  }

  const status = prismaStatusToApp(course.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Courses", href: "/courses" },
          { label: course.title },
        ]}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="relative aspect-video rounded-xl overflow-hidden mb-6 bg-gray-100 dark:bg-[#18181f]">
          {course.thumbnail ? (
            <Image
              src={course.thumbnail}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-950/40 dark:to-brand-900/30">
              <GraduationCapIcon className="w-16 h-16 text-brand-400 dark:text-brand-500 mb-3" />
              <span className="text-sm font-medium text-brand-600 dark:text-brand-400 px-8 text-center max-w-md">
                {course.title}
              </span>
            </div>
          )}
        </div>

        {isPrivileged && (
          <div className="flex items-center gap-2 mb-3">
            <CourseStatusBadge status={status} />
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
          {course.title}
        </h1>

        {course.description && (
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {course.description}
          </p>
        )}

        {/* Primary CTA — continue or review (only for enrolled users) */}
        {enrollment && (
          <EnrollButton
            courseId={id}
            isLocked={false}
            enrolled={true}
            isComplete={isCourseComplete}
            firstLessonUrl={firstLessonUrl}
            continueUrl={continueUrl}
          />
        )}

        {/* Progress bar (shown when enrolled and course has lessons) */}
        {enrollment && totalLessons > 0 && (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card px-5 py-4 mb-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1.5">
              <span>
                {completedLessons} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} complete
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {percentComplete}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full shadow-sm shadow-brand-400/30 transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            {isCourseComplete ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Course complete
              </p>
            ) : continueUrl ? (
              <Link
                href={continueUrl}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                Continue where you left off →
              </Link>
            ) : null}
          </div>
        )}

        {/* Author */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-[#2e2e3a]">
          <UserAvatar name={course.createdBy.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {course.createdBy.name || course.createdBy.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created {new Date(course.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Modules & Lessons */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#26262e]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Course Content
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {course.modules.length} module{course.modules.length !== 1 ? "s" : ""} &middot;{" "}
            {totalLessons} lesson
            {totalLessons !== 1 ? "s" : ""}
          </p>
        </div>
        <ModuleList
          courseId={id}
          completedLessonIds={completedLessonIdSet}
          deadlineInfoMap={Object.fromEntries(deadlineInfoMap)}
          modules={course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            order: m.order,
            lessons: m.lessons.map((l) => ({
              ...l,
              type: prismaLessonTypeToApp(l.type),
            })),
          }))}
        />
      </div>
    </div>
  );
}
