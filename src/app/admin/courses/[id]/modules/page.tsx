import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ModuleManager } from "@/components/courses/ModuleManager";
import { loadCourseEditData } from "@/lib/courseEditData";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CourseModulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user?.role !== "admin" && session.user?.role !== "course_manager")) {
    redirect("/");
  }

  const { id: courseId } = await params;
  const data = await loadCourseEditData(courseId, session.user!.id!, session.user!.role as Role);
  if (!data) notFound();

  const backHref = `/admin/courses/${courseId}/edit`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-sm text-primary hover:underline">
          ← Back to course
        </Link>
      </div>
      <h1 className="text-xl font-bold text-foreground mb-1">
        Modules &amp; Lessons
      </h1>
      <p className="text-sm text-foreground-muted mb-6">{data.course.title}</p>
      <ModuleManager
        courseId={courseId}
        initialModules={data.modules}
        quizDataByLessonId={data.quizDataByLessonId}
      />
    </div>
  );
}
