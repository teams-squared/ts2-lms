import { getNodeTree } from "@/lib/courseNodes";
import { ManagerNewCourseForm } from "./ManagerNewCourseForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default async function ManagerNewCoursePage() {
  const nodeTree = await getNodeTree();

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
        <ManagerNewCourseForm nodeTree={nodeTree} />
      </div>
    </div>
  );
}
