import { prisma } from "@/lib/prisma";
import { AssignmentManager } from "@/components/admin/AssignmentManager";

export const dynamic = "force-dynamic";

export default async function ManagerAssignmentsPage() {
  const [courses, users, assignments] = await Promise.all([
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
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
        Course Assignments
      </h2>
      <AssignmentManager
        courses={courses}
        users={users}
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
