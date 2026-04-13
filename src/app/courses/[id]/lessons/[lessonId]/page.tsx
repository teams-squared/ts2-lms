import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import { LessonViewer } from "@/components/courses/LessonViewer";
import { CourseSidebar } from "@/components/courses/CourseSidebar";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: courseId, lessonId } = await params;

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

  // Fetch all modules + lessons for the sidebar
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
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <LessonViewer
            title={lesson.title}
            type={prismaLessonTypeToApp(lesson.type)}
            content={lesson.content}
          />
        </div>
      </main>
    </div>
  );
}
