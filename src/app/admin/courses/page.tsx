import { GraduationCapIcon } from "@/components/icons";
import AdminCourseTable from "@/components/courses/AdminCourseTable";
import { getNodeTree } from "@/lib/courseNodes";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const nodeTree = await getNodeTree();

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <GraduationCapIcon className="w-4 h-4" />
        Course Management
      </h2>
      <AdminCourseTable nodeTree={nodeTree} />
    </div>
  );
}
