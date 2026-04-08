import Link from "next/link";
import { getAllDocs, getCategories } from "@/lib/docs";
import { getAllElevatedUsers } from "@/lib/role-store";
import { LayoutGridIcon, FileTextIcon, UsersIcon } from "@/components/icons";
import RoleManager from "@/components/admin/RoleManager";

export default async function AdminPage() {
  const [docs, categories, elevatedUsers] = await Promise.all([
    getAllDocs(),
    getCategories(),
    getAllElevatedUsers(),
  ]);

  const categoryTitleMap = Object.fromEntries(
    categories.map((c) => [c.slug, c.title])
  );

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { value: categories.length, label: "Categories", icon: LayoutGridIcon },
          { value: docs.length, label: "Documents", icon: FileTextIcon },
          { value: elevatedUsers.length, label: "Elevated Role Users", icon: UsersIcon },
        ].map(({ value, label, icon: Icon }) => (
          <div key={label} className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                {value}
              </div>
              <Icon className="w-5 h-5 text-brand-200 dark:text-brand-800" />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Role Management */}
      <div className="mb-8">
        <RoleManager />
      </div>

      {/* Categories */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Categories</h2>
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-[#26262e]">
            <thead className="bg-gray-50 dark:bg-[#18181e]">
              <tr>
                {["Category", "Min Role", "Documents"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#22222e]">
              {categories.map((cat) => {
                const catDocs = docs.filter((d) => d.category === cat.slug);
                return (
                  <tr key={cat.slug} className="hover:bg-gray-50/50 dark:hover:bg-[#1e1e28] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/docs/${cat.slug}`}
                        className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {cat.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-[#1a0d2e] text-brand-700 dark:text-brand-300">
                        {cat.minRole}+
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">All Documents</h2>
        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-[#26262e]">
            <thead className="bg-gray-50 dark:bg-[#18181e]">
              <tr>
                {["Document", "Category", "Min Role", "Updated"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#22222e]">
              {docs.map((doc) => (
                <tr key={`${doc.category}/${doc.slug}`} className="hover:bg-gray-50/50 dark:hover:bg-[#1e1e28] transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/docs/${doc.category}/${doc.slug}`}
                      className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400">
                    <Link
                      href={`/docs/${doc.category}`}
                      className="hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {categoryTitleMap[doc.category] ?? doc.category}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-[#1a0d2e] text-brand-700 dark:text-brand-300">
                      {doc.minRole}+
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-600">
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
