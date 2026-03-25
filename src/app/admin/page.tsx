import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import rolesConfig from "@/content/_roles.json";
import categories from "@/content/_categories.json";
import { getAllDocs } from "@/lib/docs";

export default async function AdminPage() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/docs");
  }

  const docs = getAllDocs();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-500">
          Manage roles, categories, and view portal statistics
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="p-6 rounded-xl border border-gray-100 bg-white">
          <div className="text-3xl font-bold text-brand-600">
            {categories.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Categories</div>
        </div>
        <div className="p-6 rounded-xl border border-gray-100 bg-white">
          <div className="text-3xl font-bold text-brand-600">
            {docs.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Documents</div>
        </div>
        <div className="p-6 rounded-xl border border-gray-100 bg-white">
          <div className="text-3xl font-bold text-brand-600">
            {rolesConfig.admins.length + rolesConfig.managers.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Elevated Role Users
          </div>
        </div>
      </div>

      {/* Role Configuration */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Role Configuration
        </h2>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                    admin
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {rolesConfig.admins.join(", ")}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    manager
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {rolesConfig.managers.join(", ")}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    employee
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  All other authenticated users (default role)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          To modify roles, edit{" "}
          <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            src/content/_roles.json
          </code>{" "}
          and redeploy.
        </p>
      </div>

      {/* Categories */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Categories
        </h2>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => {
                const catDocs = docs.filter((d) => d.category === cat.slug);
                return (
                  <tr key={cat.slug}>
                    <td className="px-6 py-4">
                      <Link
                        href={`/docs/${cat.slug}`}
                        className="text-sm font-medium text-gray-900 hover:text-brand-600"
                      >
                        {cat.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                        {cat.minRole}+
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
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
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          All Documents
        </h2>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((doc) => (
                <tr key={`${doc.category}/${doc.slug}`}>
                  <td className="px-6 py-4">
                    <Link
                      href={`/docs/${doc.category}/${doc.slug}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {doc.category}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                      {doc.minRole}+
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
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
