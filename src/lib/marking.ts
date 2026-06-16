import { prisma } from "@/lib/prisma";
import { listManagedCourseIds } from "@/lib/courseAccess";
import { finalizeIfExpired } from "@/lib/assessment";
import type { Role } from "@/lib/types";

export type MarkingSubmissionRow = {
  submissionId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
};

export type MarkingLessonGroup = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  submissions: MarkingSubmissionRow[];
};

export type MarkingCourseSegment = {
  courseId: string;
  title: string;
  pendingCount: number;
  lessons: MarkingLessonGroup[];
};

/**
 * Load the marking queue (SUBMITTED, awaiting-mark assessment submissions) for
 * an admin or course_manager, grouped course → lesson. Returns null if the
 * caller is neither role.
 *
 * Scope follows the same managed-course filter as the rest of the manager UI
 * (`listManagedCourseIds`: null = admin sees all). Stragglers — in-progress
 * attempts whose deadline has passed but whose client never fired the submit —
 * are finalized lazily here so they show up in the queue.
 */
export async function loadMarkingQueue(
  userId: string,
  role: Role,
): Promise<MarkingCourseSegment[] | null> {
  if (role !== "admin" && role !== "course_manager") return null;

  const managedIds = await listManagedCourseIds(userId, role);
  const courseFilter =
    managedIds === null ? {} : { module: { course: { id: { in: managedIds } } } };

  // Finalize expired in-progress attempts in scope so they enter the queue.
  const now = new Date();
  const expired = await prisma.assessmentSubmission.findMany({
    where: { status: "IN_PROGRESS", deadlineAt: { lt: now }, lesson: courseFilter },
    select: { id: true, status: true, deadlineAt: true },
  });
  await Promise.all(expired.map((s) => finalizeIfExpired(s, now)));

  const submissions = await prisma.assessmentSubmission.findMany({
    where: { status: "SUBMITTED", lesson: courseFilter },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      submittedAt: true,
      autoSubmitted: true,
      user: { select: { name: true, email: true, avatar: true } },
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: {
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  // Group course → lesson, preserving submittedAt ordering within each lesson.
  const courseMap = new Map<string, MarkingCourseSegment>();
  const lessonMap = new Map<string, MarkingLessonGroup>();

  for (const s of submissions) {
    const course = s.lesson.module.course;
    let courseSeg = courseMap.get(course.id);
    if (!courseSeg) {
      courseSeg = { courseId: course.id, title: course.title, pendingCount: 0, lessons: [] };
      courseMap.set(course.id, courseSeg);
    }

    const lessonKey = `${course.id}:${s.lesson.id}`;
    let lessonGroup = lessonMap.get(lessonKey);
    if (!lessonGroup) {
      lessonGroup = {
        lessonId: s.lesson.id,
        lessonTitle: s.lesson.title,
        moduleTitle: s.lesson.module.title,
        submissions: [],
      };
      lessonMap.set(lessonKey, lessonGroup);
      courseSeg.lessons.push(lessonGroup);
    }

    lessonGroup.submissions.push({
      submissionId: s.id,
      studentName: s.user.name || "Unnamed",
      studentEmail: s.user.email,
      studentAvatar: s.user.avatar,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      autoSubmitted: s.autoSubmitted,
    });
    courseSeg.pendingCount += 1;
  }

  return [...courseMap.values()].sort((a, b) => a.title.localeCompare(b.title));
}
