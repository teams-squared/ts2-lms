import { prisma } from "@/lib/prisma";
import { AssignmentManager } from "@/components/admin/AssignmentManager";

export const dynamic = "force-dynamic";

export default async function AdminAssignmentsPage() {
  const [courses, users, enrollments, assignments] = await Promise.all([
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.enrollment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.assignment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Enrollments &amp; Assignments
      </h2>
      <AssignmentManager
        courses={courses}
        users={users}
        initialEnrollments={enrollments.map((e) => ({
          id: e.id,
          course: e.course,
          user: e.user,
          enrolledAt: e.enrolledAt.toISOString(),
        }))}
        initialAssignments={assignments.map((a) => ({
          id: a.id,
          course: a.course,
          user: a.user,
          assignedBy: a.assignedBy,
          assignedAt: a.assignedAt.toISOString(),
        }))}
      />
    </div>
  );
}
