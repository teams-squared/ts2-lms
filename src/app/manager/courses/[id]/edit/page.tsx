import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { CourseEditor } from "@/components/courses/CourseEditor";

export const dynamic = "force-dynamic";

export default async function ManagerCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user?.role !== "admin" && session.user?.role !== "manager")) {
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

  // Managers may only edit courses they created
  if (session.user?.role === "manager" && course.createdById !== session.user.id) {
    redirect("/manager");
  }

  // Gather all quiz lesson IDs so we can fetch their questions in one query
  const quizLessonIds = course.modules.flatMap((m) =>
    m.lessons.filter((l) => l.type === "QUIZ").map((l) => l.id)
  );

  const rawQuizQuestions =
    quizLessonIds.length > 0
      ? await prisma.quizQuestion.findMany({
          where: { lessonId: { in: quizLessonIds } },
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        })
      : [];

  const quizDataByLessonId: Record<
    string,
    {
      questions: { id: string; text: string; order: number; options: { id: string; text: string; isCorrect: boolean; order: number }[] }[];
      passingScore: number;
    }
  > = {};

  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.type !== "QUIZ") continue;
      let passingScore = 70;
      if (lesson.content) {
        try {
          const parsed = JSON.parse(lesson.content) as { passingScore?: number };
          if (typeof parsed.passingScore === "number") passingScore = parsed.passingScore;
        } catch {
          // ignore malformed content
        }
      }
      quizDataByLessonId[lesson.id] = {
        questions: rawQuizQuestions
          .filter((q) => q.lessonId === lesson.id)
          .map((q) => ({
            id: q.id,
            text: q.text,
            order: q.order,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect,
              order: o.order,
            })),
          })),
        passingScore,
      };
    }
  }

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
          href="/manager"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back to dashboard
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
        quizDataByLessonId={quizDataByLessonId}
      />
    </div>
  );
}
