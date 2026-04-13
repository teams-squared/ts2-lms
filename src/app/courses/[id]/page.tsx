import Image from "next/image";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ModuleList } from "@/components/courses/ModuleList";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

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
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {course.description}
          </p>
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Course Content
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {course.modules.length} module{course.modules.length !== 1 ? "s" : ""} &middot;{" "}
            {course.modules.reduce((sum, m) => sum + m.lessons.length, 0)} lesson
            {course.modules.reduce((sum, m) => sum + m.lessons.length, 0) !== 1 ? "s" : ""}
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
