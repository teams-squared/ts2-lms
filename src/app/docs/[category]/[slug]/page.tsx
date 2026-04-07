import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import GithubSlugger from "github-slugger";
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
import CopyLinkButton from "@/components/docs/CopyLinkButton";
import { DocVisitRecorder } from "@/components/docs/RecentlyViewed";
import TableOfContents from "@/components/docs/TableOfContents";
import type { TocHeading } from "@/components/docs/TableOfContents";
import DocPasswordGate from "@/components/docs/DocPasswordGate";
import DocProtectionPanel from "@/components/docs/DocProtectionPanel";
import { ChevronRightIcon, LockIcon } from "@/components/icons";
import DocViewTracker from "@/components/telemetry/DocViewTracker";
import type { Role } from "@/lib/types";

function extractHeadings(mdx: string): TocHeading[] {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(mdx)) !== null) {
    const depth = match[1].length as 1 | 2 | 3;
    const text = match[2].trim();
    headings.push({ depth, text, id: slugger.slug(text) });
  }
  return headings;
}

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

  // Password gate — check for a session unlock cookie whose value matches the
  // current login's ID.  This ensures that unlock cookies left over from a
  // previous login (which had a different loginId) do not carry over.
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(`doc-unlock-${categorySlug}-${slug}`);
  const loginId = session?.user?.loginId;
  const isUnlocked =
    !doc.meta.passwordProtected ||
    (!!unlockCookie && !!loginId && unlockCookie.value === loginId);

  const headings = extractHeadings(doc.content);
  const tocHeadings = headings.length >= 3 ? headings : [];

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
          {isUnlocked ? (
            <>
              {/* Only track views when the doc is actually accessible */}
              <DocViewTracker
                title={doc.meta.title}
                slug={slug}
                category={categorySlug}
                categoryTitle={category.title}
                userRole={userRole}
              />
              <div className="mb-6 bg-brand-50/40 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {doc.meta.title}
                  </h1>
                  <CopyLinkButton />
                </div>
                <p className="text-sm text-gray-500">{doc.meta.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                  {doc.meta.author && <span>By {doc.meta.author}</span>}
                  {doc.meta.updatedAt && (
                    <span>Updated {doc.meta.updatedAt}</span>
                  )}
                  {doc.meta.minRole !== "employee" && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                      {doc.meta.minRole}+ only
                    </span>
                  )}
                  {doc.meta.passwordProtected && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 font-medium">
                      <LockIcon className="w-3 h-3" />
                      Password protected
                    </span>
                  )}
                  {doc.meta.tags && doc.meta.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {doc.meta.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/docs?tag=${encodeURIComponent(tag)}`}
                          className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium hover:bg-brand-100 transition-colors"
                        >
                          {tag}
                        </Link>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              <DocVisitRecorder
                title={doc.meta.title}
                href={`/docs/${categorySlug}/${slug}`}
              />
              <div
                id="doc-content"
                className="prose prose-sm prose-gray max-w-none prose-headings:scroll-mt-16 prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none"
              >
                <DocRenderer source={doc.content} />
              </div>

              {/* Password management — managers and admins only */}
              {hasAccess(userRole, "manager") && (
                <DocProtectionPanel
                  category={categorySlug}
                  slug={slug}
                  passwordProtected={!!doc.meta.passwordProtected}
                />
              )}
            </>
          ) : (
            <>
              <DocPasswordGate
                category={categorySlug}
                slug={slug}
                title={doc.meta.title}
                description={doc.meta.description}
              />
              {/* Managers/admins can remove protection without knowing the password */}
              {hasAccess(userRole, "manager") && (
                <DocProtectionPanel
                  category={categorySlug}
                  slug={slug}
                  passwordProtected={!!doc.meta.passwordProtected}
                />
              )}
            </>
          )}
        </article>

        <TableOfContents headings={tocHeadings} />
      </div>
    </div>
  );
}
