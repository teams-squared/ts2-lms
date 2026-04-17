import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import type { Role } from "@/lib/types";
import { canViewCourse } from "@/lib/courseAccess";
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
      createdBy: { select: { name: true, email: true, avatar: true } },
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

  const role = session.user?.role as Role;
  const isPrivileged = await canViewCourse(userId, role, id);

  // Non-privileged users can only see published courses
  if (course.status !== "PUBLISHED" && !isPrivileged) {
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
        <div className="relative mb-6 aspect-video overflow-hidden rounded-lg bg-surface-muted">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary-subtle">
              <GraduationCapIcon className="mb-3 h-16 w-16 text-primary/70" />
              <span className="max-w-md px-8 text-center text-sm font-medium text-primary">
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

        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {course.title}
        </h1>

        {course.description && (
          <p className="mb-4 text-base leading-relaxed text-foreground-muted">
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
          <div className="mb-4 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
            <div className="mb-1.5 flex justify-between text-sm text-foreground-muted">
              <span>
                {completedLessons} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} complete
              </span>
              <span className="font-medium text-foreground">
                {percentComplete}%
              </span>
            </div>
            <div className="mb-3 h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            {isCourseComplete ? (
              <p className="text-xs font-medium text-success">
                ✓ Course complete
              </p>
            ) : continueUrl ? (
              <Link
                href={continueUrl}
                className="text-xs font-medium text-primary hover:underline"
              >
                Continue where you left off →
              </Link>
            ) : null}
          </div>
        )}

        {/* Author */}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <UserAvatar name={course.createdBy.name} image={course.createdBy.avatar} size="sm" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {course.createdBy.name || course.createdBy.email}
            </p>
            <p className="text-xs text-foreground-muted">
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
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            Course Content
          </h2>
          <p className="mt-0.5 text-xs text-foreground-subtle">
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
