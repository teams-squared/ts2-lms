import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getNodeTree } from "@/lib/courseNodes";
import { listManagedCourseIds } from "@/lib/courseAccess";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import type { NodeWithChildren } from "@/lib/courseNodes";
import type { Role } from "@/lib/types";

/**
 * Filter a node tree in place by removing courses outside `keepIds`.
 * Nodes whose subtree ends up empty are pruned. Used to scope the course
 * picker to courses a course_manager actually manages.
 */
function filterTreeToCourseIds(
  nodes: NodeWithChildren[],
  keepIds: Set<string>,
): NodeWithChildren[] {
  return nodes
    .map((n) => ({
      ...n,
      courses: n.courses.filter((c) => keepIds.has(c.id)),
      children: filterTreeToCourseIds(n.children, keepIds),
    }))
    .filter((n) => n.courses.length > 0 || n.children.length > 0);
}

export async function AssignmentsPageContent() {
  const session = await auth();
  const userId = session!.user!.id!;
  const role = (session!.user!.role ?? "employee") as Role;

  const managedIds = await listManagedCourseIds(userId, role);
  const enrollmentWhere =
    managedIds === null ? {} : { courseId: { in: managedIds } };

  const [fullNodeTree, users, enrollments] = await Promise.all([
    getNodeTree({ publishedOnly: true }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.enrollment.findMany({
      where: enrollmentWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        enrolledBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
  ]);

  const nodeTree =
    managedIds === null
      ? fullNodeTree
      : filterTreeToCourseIds(fullNodeTree, new Set(managedIds));

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
