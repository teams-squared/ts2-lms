import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, prismaLessonTypeToApp } from "@/lib/types";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

/**
 * Loads all data needed to render the course editor page.
 * Returns null if the course doesn't exist or the user lacks permission.
 */
export async function loadCourseEditData(
  courseId: string,
  userId: string,
  role: Role,
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!course) return null;

  const allowed = await canManageCourse(userId, role, courseId);
  if (!allowed) return null;

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
      questions: {
        id: string;
        text: string;
        order: number;
        options: { id: string; text: string; isCorrect: boolean; order: number }[];
      }[];
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
      deadlineDays: l.deadlineDays,
    })),
  }));

  return {
    course,
    modules,
    quizDataByLessonId,
    status: prismaStatusToApp(course.status),
    nodeId: course.nodeId,
  };
}
