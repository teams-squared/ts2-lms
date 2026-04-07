import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminTabs from "@/components/admin/AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/docs");
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Manage roles, categories, and view portal statistics
        </p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
