import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (
    !session ||
    (session.user?.role !== "admin" && session.user?.role !== "course_manager")
  ) {
    redirect("/");
  }

  const isCourseManager = session.user?.role === "course_manager";
  const heading = isCourseManager ? "Course Management" : "Admin Dashboard";
  const subheading = isCourseManager
    ? "Manage courses, nodes, and enrollments"
    : "Manage users, courses, and analytics";

  return (
    <div>
      <div className="bg-surface-muted">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight mb-1">
            {heading}
          </h1>
          <p className="text-base text-foreground-muted">{subheading}</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
