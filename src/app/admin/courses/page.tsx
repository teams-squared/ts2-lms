import { GraduationCapIcon } from "@/components/icons";
import AdminCourseTable from "@/components/courses/AdminCourseTable";
import { getNodeTree } from "@/lib/courseNodes";
import type { NodeWithChildren } from "@/lib/courseNodes";

export const dynamic = "force-dynamic";

function flattenNodes(nodes: NodeWithChildren[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenNodes(n.children, depth + 1));
  }
  return result;
}

export default async function AdminCoursesPage() {
  const nodeTree = await getNodeTree();
  const nodeOptions = flattenNodes(nodeTree);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <GraduationCapIcon className="w-4 h-4" />
        Course Management
      </h2>
      <AdminCourseTable nodeOptions={nodeOptions} />
    </div>
  );
}
