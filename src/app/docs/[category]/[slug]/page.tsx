import Link from "next/link";
import { notFound } from "next/navigation";
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
import Quiz from "@/components/docs/Quiz";
import MarkCompleteButton from "@/components/docs/MarkCompleteButton";
import { getUserProgress } from "@/lib/progress-store";
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

  const docKey = `${categorySlug}/${slug}`;
  const unlockedDocs = session?.user?.unlockedDocs ?? [];
  const isUnlocked = !doc.meta.passwordProtected || unlockedDocs.includes(docKey);

  const userEmail = session?.user?.email;
  const userProgress = userEmail ? getUserProgress(userEmail) : null;
  const docProgress = userProgress?.docs[docKey] ?? null;

  const headings = extractHeadings(doc.content);
  const tocHeadings = headings.length >= 3 ? headings : [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap text-xs text-gray-400 dark:text-gray-600 mb-6 gap-y-1">
        <Link href="/" className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
          Home
        </Link>
        <ChevronRightIcon className="w-3 h-3 mx-1.5 flex-shrink-0" />
        <Link href="/docs" className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
          Docs
        </Link>
        <ChevronRightIcon className="w-3 h-3 mx-1.5 flex-shrink-0" />
        {parentCategory && (
          <>
            <Link
              href={`/docs/${parentCategory.slug}`}
              className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
            >
              {parentCategory.title}
            </Link>
            <ChevronRightIcon className="w-3 h-3 mx-1.5 flex-shrink-0" />
          </>
        )}
        <Link
          href={`/docs/${categorySlug}`}
          className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
        >
          {category.title}
        </Link>
        <ChevronRightIcon className="w-3 h-3 mx-1.5 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300 font-medium">{doc.meta.title}</span>
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
              <DocViewTracker
                title={doc.meta.title}
                slug={slug}
                category={categorySlug}
                categoryTitle={category.title}
                userRole={userRole}
              />

              {/* Doc header */}
              <div className="mb-6 rounded-xl border border-gray-100 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
                    {doc.meta.title}
                  </h1>
                  <CopyLinkButton />
                </div>
                {doc.meta.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{doc.meta.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-gray-400 dark:text-gray-600">
                  {doc.meta.author && (
                    <span className="flex items-center gap-1">By {doc.meta.author}</span>
                  )}
                  {doc.meta.updatedAt && (
                    <span>Updated {doc.meta.updatedAt}</span>
                  )}
                  {doc.meta.minRole !== "employee" && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium border border-amber-100 dark:border-amber-900/50">
                      {doc.meta.minRole}+ only
                    </span>
                  )}
                  {doc.meta.passwordProtected && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-[#1a0d2e] text-brand-600 dark:text-brand-400 font-medium border border-brand-100 dark:border-brand-900/50">
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
                          className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#26262e] text-gray-600 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-[#1a0d2e] hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
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
                className="prose prose-sm prose-gray dark:prose-invert max-w-none prose-headings:scroll-mt-16 prose-a:text-brand-600 dark:prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none"
              >
                <DocRenderer source={doc.content} />
              </div>

              {session && (
                doc.quiz ? (
                  <Quiz
                    quiz={doc.quiz}
                    docKey={docKey}
                    existingProgress={docProgress}
                  />
                ) : (
                  <MarkCompleteButton
                    docKey={docKey}
                    existingProgress={docProgress}
                  />
                )
              )}

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
