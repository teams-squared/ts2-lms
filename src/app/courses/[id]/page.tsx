import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { checkCourseEligibility } from "@/lib/course-eligibility";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ModuleList } from "@/components/courses/ModuleList";
import { LockIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

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
            select: { id: true, title: true, type: true, order: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  // Non-privileged users can only see published courses
  if (
    course.status !== "PUBLISHED" &&
    session.user?.role !== "admin" &&
    course.createdById !== session.user?.id
  ) {
    notFound();
  }

  // Check course eligibility
  const eligibility = await checkCourseEligibility(
    userId,
    (session.user?.role ?? "employee") as Role,
    id,
  );
  const isLocked = !eligibility.eligible;

  // Fetch enrollment + progress
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: id } },
  });

  const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const totalLessons = allLessonIds.length;

  let completedLessons = 0;
  let percentComplete = 0;

  if (enrollment && totalLessons > 0) {
    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
    });
    completedLessons = progressRecords.length;
    percentComplete = Math.round((completedLessons / totalLessons) * 1000) / 10;
  }

  const status = prismaStatusToApp(course.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        {course.thumbnail && (
          <div className="relative aspect-video rounded-xl overflow-hidden mb-6 bg-gray-100 dark:bg-[#18181f]">
            <Image
              src={course.thumbnail}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <CourseStatusBadge status={status} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
          {course.title}
        </h1>

        {course.description && (
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {course.description}
          </p>
        )}

        {/* Lock banner */}
        {isLocked && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 mb-4">
            <div className="flex items-start gap-3">
              <LockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  This course is locked
                </p>
                {eligibility.missingPrerequisites.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                      Complete these courses first:
                    </p>
                    <ul className="space-y-1">
                      {eligibility.missingPrerequisites.map((prereq) => (
                        <li key={prereq.id}>
                          <Link
                            href={`/courses/${prereq.id}`}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            {prereq.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {eligibility.missingClearance && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    Requires <span className="font-medium">{eligibility.missingClearance}</span> clearance — contact your administrator.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress bar (shown when enrolled and course has lessons) */}
        {enrollment && totalLessons > 0 && (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card px-4 py-3 mb-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1.5">
              <span>
                {completedLessons} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} complete
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {percentComplete}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-[#2e2e3a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full shadow-sm shadow-brand-400/30 transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
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
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#26262e]">
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
