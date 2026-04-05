import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAccessibleCategories,
  getDocsByCategory,
  getCategoryBySlug,
  getSubcategoriesOf,
} from "@/lib/docs";
import { hasAccess } from "@/lib/roles";
import Sidebar from "@/components/layout/Sidebar";
import CategoryCard from "@/components/docs/CategoryCard";
import { ChevronRightIcon, FileTextIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";

  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();
  if (!hasAccess(userRole, category.minRole)) notFound();

  const [categories, subcategories, docs] = await Promise.all([
    getAccessibleCategories(userRole),
    getSubcategoriesOf(categorySlug, userRole),
    getDocsByCategory(categorySlug, userRole),
  ]);

  // Parent category: has subcategories but no docs directly
  if (subcategories.length > 0 && docs.length === 0) {
    const subcatDocs = await Promise.all(
      subcategories.map(async (sub) => ({
        sub,
        docs: await getDocsByCategory(sub.slug, userRole),
      }))
    );

    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
        <nav className="flex items-center text-sm text-gray-500 mb-5">
          <Link href="/" className="hover:text-brand-600">Home</Link>
          <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
          <Link href="/docs" className="hover:text-brand-600">Docs</Link>
          <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
          <span className="text-gray-900 font-medium">{category.title}</span>
        </nav>

        <div className="flex gap-8">
          <Sidebar categories={categories} currentCategory={categorySlug} />

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {category.title}
            </h1>
            <p className="text-sm text-gray-500 mb-5">{category.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {subcatDocs.map(({ sub, docs: subDocs }) => (
                <CategoryCard
                  key={sub.slug}
                  category={sub}
                  docCount={subDocs.length}
                  docTitles={subDocs.map((d) => d.title)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular category: has docs
  const parentTitle = category.parentCategory
    ? (await getCategoryBySlug(category.parentCategory))?.title
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      <nav className="flex items-center text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
        <Link href="/docs" className="hover:text-brand-600">Docs</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
        {category.parentCategory && parentTitle && (
          <>
            <Link
              href={`/docs/${category.parentCategory}`}
              className="hover:text-brand-600"
            >
              {parentTitle}
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
          </>
        )}
        <span className="text-gray-900 font-medium">{category.title}</span>
      </nav>

      <div className="flex gap-8">
        <Sidebar
          categories={categories}
          currentCategory={categorySlug}
          docs={docs}
        />

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {category.title}
          </h1>
          <p className="text-sm text-gray-500 mb-5">{category.description}</p>

          {docs.length > 0 ? (
            <div className="space-y-2">
              {docs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/docs/${categorySlug}/${doc.slug}`}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-200/60 bg-white shadow-card hover:shadow-card-hover hover:border-brand-300 border-l-2 border-l-transparent hover:border-l-brand-500 transition-all group"
                >
                  <FileTextIcon className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0 group-hover:text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {doc.author && <span>By {doc.author}</span>}
                      {doc.updatedAt && <span>Updated {doc.updatedAt}</span>}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex gap-1">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              No documents in this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
