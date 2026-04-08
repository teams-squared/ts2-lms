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
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_ACCENT_COLORS, ChevronRightIcon, FileTextIcon, LockIcon } from "@/components/icons";
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

  const CatIcon = CATEGORY_ICONS[category.icon] || FileTextIcon;
  const catColor = CATEGORY_COLORS[category.icon] || "var(--cat-shield)";
  const catAccent = CATEGORY_ACCENT_COLORS[category.icon] || "#a78bfa";

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
        <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-5">
          <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400">Home</Link>
          <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300 dark:text-gray-600" />
          <Link href="/docs" className="hover:text-brand-600 dark:hover:text-brand-400">Docs</Link>
          <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300 dark:text-gray-600" />
          <span className="text-gray-900 dark:text-gray-200 font-medium">{category.title}</span>
        </nav>

        <div className="flex gap-8">
          <Sidebar categories={categories} currentCategory={categorySlug} />

          <div className="flex-1 min-w-0">
            {/* Rich category header */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-[#26262e]">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: catColor }}
              >
                <CatIcon className="w-5 h-5" style={{ color: "var(--icon-fg)" }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{category.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
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
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-5">
        <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400">Home</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300 dark:text-gray-600" />
        <Link href="/docs" className="hover:text-brand-600 dark:hover:text-brand-400">Docs</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300 dark:text-gray-600" />
        {category.parentCategory && parentTitle && (
          <>
            <Link
              href={`/docs/${category.parentCategory}`}
              className="hover:text-brand-600 dark:hover:text-brand-400"
            >
              {parentTitle}
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300 dark:text-gray-600" />
          </>
        )}
        <span className="text-gray-900 dark:text-gray-200 font-medium">{category.title}</span>
      </nav>

      <div className="flex gap-8">
        <Sidebar
          categories={categories}
          currentCategory={categorySlug}
          docs={docs}
        />

        <div className="flex-1 min-w-0">
          {/* Rich category header */}
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-[#26262e]">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: catColor }}
            >
              <CatIcon className="w-5 h-5" style={{ color: "var(--icon-fg)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{category.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
            </div>
          </div>

          {docs.length > 0 ? (
            <div className="space-y-2">
              {docs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/docs/${categorySlug}/${doc.slug}`}
                  className="flex items-stretch rounded-lg border border-gray-200/60 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-150 group overflow-hidden"
                >
                  {/* Left category color accent */}
                  <div className="w-1 flex-shrink-0" style={{ backgroundColor: catAccent }} />

                  <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
                    <FileTextIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-0.5 flex-shrink-0 group-hover:text-brand-400 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {doc.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {doc.author && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-[#2e2e3a] text-gray-600 dark:text-gray-400 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                              {doc.author[0].toUpperCase()}
                            </span>
                            {doc.author}
                          </span>
                        )}
                        {doc.updatedAt && (
                          <span className="text-xs text-gray-400 dark:text-gray-600">{doc.updatedAt}</span>
                        )}
                        {doc.minRole !== "employee" && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                            <LockIcon className="w-2.5 h-2.5" />
                            {doc.minRole}
                          </span>
                        )}
                        {doc.passwordProtected && (
                          <span className="flex items-center gap-0.5 text-[10px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-[#1a0d2e] px-1.5 py-0.5 rounded-full">
                            <LockIcon className="w-2.5 h-2.5" />
                            password
                          </span>
                        )}
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex gap-1">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2e2e3a] text-gray-500 dark:text-gray-400 text-[10px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-400 mt-0.5 flex-shrink-0 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
              No documents in this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
