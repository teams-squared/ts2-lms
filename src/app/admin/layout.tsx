import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/");
  }

  return (
    <div>
      <div className="bg-page-header-gradient">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
            Admin Dashboard
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Manage users, courses, and analytics
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
