import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { CourseEditor } from "@/components/courses/CourseEditor";

export const dynamic = "force-dynamic";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/");
  }

  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const modules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: prismaLessonTypeToApp(l.type),
      content: l.content,
      order: l.order,
    })),
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/courses"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back to courses
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Edit: {course.title}
      </h1>
      <CourseEditor
        courseId={courseId}
        initialTitle={course.title}
        initialDescription={course.description}
        initialStatus={prismaStatusToApp(course.status)}
        initialModules={modules}
      />
    </div>
  );
}
