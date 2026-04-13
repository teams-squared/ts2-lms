import { GraduationCapIcon } from "@/components/icons";
import AdminCourseTable from "@/components/courses/AdminCourseTable";

export const dynamic = "force-dynamic";

export default function AdminCoursesPage() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <GraduationCapIcon className="w-4 h-4" />
        Course Management
      </h2>
      <AdminCourseTable />
    </div>
  );
}
