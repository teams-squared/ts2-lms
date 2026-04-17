import { prisma } from "@/lib/prisma";
import { getNodeTree } from "@/lib/courseNodes";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";

export async function AssignmentsPageContent() {
  const [nodeTree, users, enrollments] = await Promise.all([
    getNodeTree({ publishedOnly: true }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.enrollment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        enrolledBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">
        Enrollments
      </h2>
      <EnrollmentManager
        nodeTree={nodeTree}
        users={users}
        initialEnrollments={enrollments.map((e) => ({
          id: e.id,
          course: e.course,
          user: e.user,
          enrolledBy: e.enrolledBy,
          enrolledAt: e.enrolledAt.toISOString(),
        }))}
      />
    </div>
  );
}
