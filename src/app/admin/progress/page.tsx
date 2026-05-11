import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadCourseProgress } from "@/lib/courseProgress";
import { CourseProgressTable } from "@/components/admin/CourseProgressTable";

export const dynamic = "force-dynamic";

export default async function AdminProgressPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "course_manager")
  ) {
    redirect("/");
  }

  const userId = session.user.id as string;
  const role = session.user.role;
  const segments = (await loadCourseProgress(userId, role)) ?? [];

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center">
        <p className="text-sm font-medium text-foreground mb-1">
          No managed courses yet
        </p>
        <p className="text-xs text-foreground-muted">
          {role === "course_manager"
            ? "Ask an admin to assign you as a manager on a course."
            : "Create a course to start tracking student progress."}
        </p>
      </div>
    );
  }

  return <CourseProgressTable segments={segments} />;
}
