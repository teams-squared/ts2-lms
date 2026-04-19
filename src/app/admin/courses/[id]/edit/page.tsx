import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "@/components/courses/CourseEditor";
import { CourseDeleteZone } from "@/components/courses/CourseDeleteZone";
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
  const [data, nodeTree, subs] = await Promise.all([
    loadCourseEditData(courseId, session.user!.id!, session.user!.role as Role),
    getNodeTree(),
    prisma.courseEmailSubscription.findMany({
      where: { courseId },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    }),
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
      <h1 className="text-xl font-bold text-foreground mb-6">
        Edit: {data.course.title}
      </h1>
      <CourseEditor
        courseId={courseId}
        initialTitle={data.course.title}
        initialDescription={data.course.description}
        initialStatus={data.status}
        initialNodeId={data.nodeId}
        nodeTree={nodeTree}
        initialModules={data.modules}
        quizDataByLessonId={data.quizDataByLessonId}
        initialSubscriptions={subs.map((s) => s.email)}
      />
      <div className="mt-8">
        <CourseDeleteZone courseId={courseId} courseTitle={data.course.title} />
      </div>
    </div>
  );
}
