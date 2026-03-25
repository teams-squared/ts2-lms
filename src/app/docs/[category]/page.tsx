import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAccessibleCategories,
  getDocsByCategory,
  getCategoryBySlug,
} from "@/lib/docs";
import { hasAccess } from "@/lib/roles";
import Sidebar from "@/components/layout/Sidebar";
import type { Role } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";

  const category = getCategoryBySlug(categorySlug);
  if (!category) notFound();
  if (!hasAccess(userRole, category.minRole)) notFound();

  const categories = getAccessibleCategories(userRole);
  const docs = getDocsByCategory(categorySlug, userRole);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-brand-600">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/docs" className="hover:text-brand-600">
          Docs
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{category.title}</span>
      </nav>

      <div className="flex gap-8">
        <Sidebar
          categories={categories}
          currentCategory={categorySlug}
          docs={docs}
        />

        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {category.title}
          </h1>
          <p className="text-gray-500 mb-8">{category.description}</p>

          {docs.length > 0 ? (
            <div className="space-y-3">
              {docs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/docs/${categorySlug}/${doc.slug}`}
                  className="block p-5 rounded-xl border border-gray-100 bg-white hover:border-brand-200 hover:shadow-sm transition-all group"
                >
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {doc.description}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    {doc.author && <span>By {doc.author}</span>}
                    {doc.updatedAt && (
                      <span>Updated {doc.updatedAt}</span>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              No documents in this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
