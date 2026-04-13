import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";

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
    include: { createdBy: { select: { name: true, email: true } } },
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
          <div className="aspect-video rounded-xl overflow-hidden mb-6 bg-gray-100 dark:bg-[#18181f]">
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover"
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

      {/* Modules placeholder */}
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Course Content
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Modules and lessons coming soon.
        </p>
      </div>
    </div>
  );
}
