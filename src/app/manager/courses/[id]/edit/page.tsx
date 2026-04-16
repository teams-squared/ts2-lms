import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "@/components/courses/CourseEditor";
import { loadCourseEditData } from "@/lib/courseEditData";
import { getNodeTree } from "@/lib/courseNodes";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session || (role !== "admin" && role !== "manager" && role !== "instructor")) {
    redirect("/");
  }

  const { id: courseId } = await params;
  const [data, nodeTree, subs] = await Promise.all([
    loadCourseEditData(courseId, session.user!.id!, role as Role),
    getNodeTree(),
    prisma.courseEmailSubscription.findMany({
      where: { courseId },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!data) notFound();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/manager"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
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
    </div>
  );
}
