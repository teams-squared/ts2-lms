import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "@/components/courses/CourseEditor";
import { CourseDeleteZone } from "@/components/courses/CourseDeleteZone";
import { CourseManagersPanel } from "@/components/admin/CourseManagersPanel";
import { loadCourseEditData } from "@/lib/courseEditData";
import { getNodeTree } from "@/lib/courseNodes";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user?.role !== "admin" && session.user?.role !== "course_manager")) {
    redirect("/");
  }

  const { id: courseId } = await params;
  const isAdmin = session.user!.role === "admin";
  const [data, nodeTree, subs, managerData] = await Promise.all([
    loadCourseEditData(courseId, session.user!.id!, session.user!.role as Role),
    getNodeTree(),
    prisma.courseEmailSubscription.findMany({
      where: { courseId },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    }),
    isAdmin
      ? Promise.all([
          prisma.course.findUnique({
            where: { id: courseId },
            select: {
              managers: {
                select: { id: true, name: true, email: true, role: true },
                orderBy: { name: "asc" },
              },
            },
          }),
          prisma.user.findMany({
            where: { role: { in: ["ADMIN", "COURSE_MANAGER"] } },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" },
          }),
        ])
      : Promise.resolve(null),
  ]);
  if (!data) notFound();

  const backHref = "/admin/courses";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref}
          className="text-sm text-primary hover:underline"
        >
          ← Back
        </Link>
      </div>
      <h1 className="font-display text-xl font-bold text-foreground mb-6">
        Edit: {data.course.title}
      </h1>
      <CourseEditor
        courseId={courseId}
        initialTitle={data.course.title}
        initialDescription={data.course.description}
        initialStatus={data.status}
        initialNodeId={data.nodeId}
        nodeTree={nodeTree}
        initialSubscriptions={subs.map((s) => s.email)}
      />
      {isAdmin && managerData && managerData[0] && (
        <div className="mt-8">
          <CourseManagersPanel
            courseId={courseId}
            initialManagers={managerData[0].managers as Array<{
              id: string;
              name: string | null;
              email: string;
              role: "ADMIN" | "COURSE_MANAGER";
            }>}
            assignableUsers={managerData[1] as Array<{
              id: string;
              name: string | null;
              email: string;
              role: "ADMIN" | "COURSE_MANAGER";
            }>}
          />
        </div>
      )}
      <div className="mt-8">
        {/* By the time we render, loadCourseEditData has already verified
            canManageCourse — admin or a course_manager linked to this course
            via the CourseManagers m2m. So the delete control is always
            available here. */}
        <CourseDeleteZone courseId={courseId} courseTitle={data.course.title} />
      </div>
    </div>
  );
}
