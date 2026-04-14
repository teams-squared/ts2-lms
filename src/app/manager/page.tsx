import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isInstructor = role === "instructor";

  // Instructors see their assigned courses; managers/admins see courses they created
  const courseQuery = isInstructor
    ? prisma.course.findMany({
        where: { instructors: { some: { userId } } },
        include: {
          modules: { include: { lessons: { select: { id: true } } } },
          enrollments: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : prisma.course.findMany({
        where: { createdById: userId },
        include: {
          modules: { include: { lessons: { select: { id: true } } } },
          enrollments: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      });

  const courses = await courseQuery;

  const totalCourses = courses.length;
  const totalLessons = courses.reduce(
    (sum, c) => sum + c.modules.reduce((ms, m) => ms + m.lessons.length, 0),
    0
  );
  const totalEnrolled = courses.reduce((sum, c) => sum + c.enrollments.length, 0);

  const stats = [
    { label: "My Courses", value: totalCourses },
    { label: "Total Lessons", value: totalLessons },
    { label: "Enrolled Users", value: totalEnrolled },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-sm hover-lift overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400" />
            <div className="p-5">
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums mb-1">
                {value}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        {!isInstructor && (
          <>
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 transition-colors"
            >
              + Create new course
            </Link>
            <Link
              href="/manager/assignments"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1c1c24] text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
            >
              Manage assignments
            </Link>
          </>
        )}
      </div>

      {/* Course list */}
      {courses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-[#2e2e3a] p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isInstructor
              ? "No courses have been assigned to you yet."
              : "You have not created any courses yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Course
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                  Lessons
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                  Enrolled
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
              {courses.map((course) => {
                const lessonCount = course.modules.reduce(
                  (s, m) => s + m.lessons.length,
                  0
                );
                return (
                  <tr
                    key={course.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {course.title}
                      </p>
                      {course.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {course.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <CourseStatusBadge status={prismaStatusToApp(course.status)} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">
                      {lessonCount}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">
                      {course.enrollments.length}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/manager/courses/${course.id}/edit`}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/courses/${course.id}`}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:underline font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
