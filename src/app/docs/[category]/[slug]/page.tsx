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
import type { Role } from "@/lib/types";

export default async function DocPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category: categorySlug, slug } = await params;
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";

  const category = getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const doc = getDocContent(categorySlug, slug);
  if (!doc) notFound();
  if (!hasAccess(userRole, doc.meta.minRole)) notFound();

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
        <Link
          href={`/docs/${categorySlug}`}
          className="hover:text-brand-600"
        >
          {category.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{doc.meta.title}</span>
      </nav>

      <div className="flex gap-8">
        <Sidebar
          categories={categories}
          currentCategory={categorySlug}
          docs={docs}
        />

        <article className="flex-1 min-w-0">
          {/* Doc header */}
          <div className="mb-8 pb-6 border-b border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {doc.meta.title}
            </h1>
            <p className="text-gray-500">{doc.meta.description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              {doc.meta.author && <span>By {doc.meta.author}</span>}
              {doc.meta.updatedAt && (
                <span>Updated {doc.meta.updatedAt}</span>
              )}
              {doc.meta.minRole !== "employee" && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                  {doc.meta.minRole}+ only
                </span>
              )}
            </div>
          </div>

          {/* Rendered MDX content */}
          <div className="prose prose-gray max-w-none prose-headings:scroll-mt-20 prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none">
            <DocRenderer source={doc.content} />
          </div>
        </article>
      </div>
    </div>
  );
}
