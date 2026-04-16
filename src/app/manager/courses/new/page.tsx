import { getNodeTree } from "@/lib/courseNodes";
import type { NodeWithChildren } from "@/lib/courseNodes";
import { ManagerNewCourseForm } from "./ManagerNewCourseForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

function flattenNodes(nodes: NodeWithChildren[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenNodes(n.children, depth + 1));
  }
  return result;
}

export default async function ManagerNewCoursePage() {
  const nodeTree = await getNodeTree();
  const nodeOptions = flattenNodes(nodeTree);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Manager", href: "/manager" },
          { label: "New Course" },
        ]}
      />
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Create New Course
      </h1>
      <div className="max-w-lg">
        <ManagerNewCourseForm nodeOptions={nodeOptions} />
      </div>
    </div>
  );
}
