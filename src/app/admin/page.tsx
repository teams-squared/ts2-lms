import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import categories from "@/content/_categories.json";
import { getAllDocs } from "@/lib/docs";
import { getAllElevatedUsers } from "@/lib/role-store";
import { LayoutGridIcon, FileTextIcon, UsersIcon } from "@/components/icons";
import RoleManager from "@/components/admin/RoleManager";

export default async function AdminPage() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/docs");
  }

  const docs = getAllDocs();
  const elevatedUsers = await getAllElevatedUsers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Manage roles, categories, and view portal statistics
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-gray-200/60 bg-white shadow-card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl font-bold text-brand-600">
              {categories.length}
            </div>
            <LayoutGridIcon className="w-5 h-5 text-brand-300" />
          </div>
          <div className="text-xs text-gray-500">Categories</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200/60 bg-white shadow-card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl font-bold text-brand-600">
              {docs.length}
            </div>
            <FileTextIcon className="w-5 h-5 text-brand-300" />
          </div>
          <div className="text-xs text-gray-500">Documents</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200/60 bg-white shadow-card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl font-bold text-brand-600">
              {elevatedUsers.length}
            </div>
            <UsersIcon className="w-5 h-5 text-brand-300" />
          </div>
          <div className="text-xs text-gray-500">Elevated Role Users</div>
        </div>
      </div>

      {/* Role Management */}
      <div className="mb-8">
        <RoleManager />
      </div>

      {/* Categories */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Categories
        </h2>
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => {
                const catDocs = docs.filter((d) => d.category === cat.slug);
                return (
                  <tr key={cat.slug}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/docs/${cat.slug}`}
                        className="text-sm font-medium text-gray-900 hover:text-brand-600"
                      >
                        {cat.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                        {cat.minRole}+
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {catDocs.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Documents */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          All Documents
        </h2>
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((doc) => (
                <tr key={`${doc.category}/${doc.slug}`}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/docs/${doc.category}/${doc.slug}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {doc.category}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                      {doc.minRole}+
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-400">
                    {doc.updatedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
