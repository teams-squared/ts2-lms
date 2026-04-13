import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { CourseCard } from "@/components/courses/CourseCard";
import { GraduationCapIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CourseCatalogPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isPrivileged =
    session.user?.role === "admin" || session.user?.role === "manager";

  const courses = await prisma.course.findMany({
    where: isPrivileged
      ? {
          OR: [
            { status: "PUBLISHED" },
            { createdById: session.user?.id },
          ],
        }
      : { status: "PUBLISHED" },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 flex items-center gap-2">
          <GraduationCapIcon className="w-6 h-6" />
          Course Catalog
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Browse available courses
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          No courses available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              title={course.title}
              description={course.description}
              status={prismaStatusToApp(course.status)}
              thumbnail={course.thumbnail}
              createdBy={course.createdBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
