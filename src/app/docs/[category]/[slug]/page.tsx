import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAccessibleCategories,
  getDocsByCategory,
  getDocContent,
  getCategoryBySlug,
} from "@/lib/docs";
import { hasAccess } from "@/lib/roles";
import Sidebar from "@/components/layout/Sidebar";
import DocRenderer from "@/components/docs/DocRenderer";
import DocSearch from "@/components/docs/DocSearch";
import { ChevronRightIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

export default async function DocPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category: categorySlug, slug } = await params;
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";

  const [category, doc, categories, docs] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getDocContent(categorySlug, slug),
    getAccessibleCategories(userRole),
    getDocsByCategory(categorySlug, userRole),
  ]);

  const parentCategory = category?.parentCategory
    ? await getCategoryBySlug(category.parentCategory)
    : null;

  if (!category) notFound();
  if (!doc) notFound();
  if (!hasAccess(userRole, doc.meta.minRole)) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-brand-600">
          Home
        </Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
        <Link href="/docs" className="hover:text-brand-600">
          Docs
        </Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
        {parentCategory && (
          <>
            <Link
              href={`/docs/${parentCategory.slug}`}
              className="hover:text-brand-600"
            >
              {parentCategory.title}
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
          </>
        )}
        <Link
          href={`/docs/${categorySlug}`}
          className="hover:text-brand-600"
        >
          {category.title}
        </Link>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1.5 text-gray-300" />
        <span className="text-gray-900 font-medium">{doc.meta.title}</span>
      </nav>

      <div className="flex gap-8">
        <Sidebar
          categories={categories}
          currentCategory={categorySlug}
          docs={docs}
        />

        <article className="flex-1 min-w-0 max-w-3xl">
          <DocSearch />
          <div className="mb-6 bg-brand-50/40 rounded-lg px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {doc.meta.title}
            </h1>
            <p className="text-sm text-gray-500">{doc.meta.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {doc.meta.author && <span>By {doc.meta.author}</span>}
              {doc.meta.updatedAt && (
                <span>Updated {doc.meta.updatedAt}</span>
              )}
              {doc.meta.minRole !== "employee" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                  {doc.meta.minRole}+ only
                </span>
              )}
            </div>
          </div>

          <div id="doc-content" className="prose prose-sm prose-gray max-w-none prose-headings:scroll-mt-16 prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none">
            <DocRenderer source={doc.content} />
          </div>
        </article>
      </div>
    </div>
  );
}
