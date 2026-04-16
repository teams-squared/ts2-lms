import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "@/components/courses/CourseEditor";
import { loadCourseEditData } from "@/lib/courseEditData";
import { getNodeTree } from "@/lib/courseNodes";
import type { NodeWithChildren } from "@/lib/courseNodes";
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
  const [data, nodeTree] = await Promise.all([
    loadCourseEditData(courseId, session.user!.id!, role as Role),
    getNodeTree(),
  ]);
  if (!data) notFound();

  function flattenNodes(nodes: NodeWithChildren[], depth = 0): { id: string; name: string; depth: number }[] {
    const result: { id: string; name: string; depth: number }[] = [];
    for (const n of nodes) {
      result.push({ id: n.id, name: n.name, depth });
      result.push(...flattenNodes(n.children, depth + 1));
    }
    return result;
  }
  const nodeOptions = flattenNodes(nodeTree);

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
        nodeOptions={nodeOptions}
        initialModules={data.modules}
        quizDataByLessonId={data.quizDataByLessonId}
      />
    </div>
  );
}
