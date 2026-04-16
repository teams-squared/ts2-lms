import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CourseEditor } from "@/components/courses/CourseEditor";
import { loadCourseEditData } from "@/lib/courseEditData";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user?.role !== "admin" && session.user?.role !== "manager")) {
    redirect("/");
  }

  const { id: courseId } = await params;
  const data = await loadCourseEditData(courseId, session.user!.id!, session.user!.role as Role);
  if (!data) notFound();

  const backHref = session.user?.role === "manager" ? "/manager" : "/admin/courses";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          ← Back
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
        initialModules={data.modules}
        quizDataByLessonId={data.quizDataByLessonId}
      />
    </div>
  );
}
