import { Suspense } from "react";
import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getSubcategoriesOf,
  getDocsByCategory,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import TagFilter from "@/components/docs/TagFilter";
import { BookOpenIcon, CATEGORY_ICONS, CATEGORY_COLORS } from "@/components/icons";
import type { DocMeta, Role } from "@/lib/types";

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tag: activeTag } = await searchParams;
  const tagFilter = typeof activeTag === "string" ? activeTag : undefined;

  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";
  const topLevel = await getTopLevelCategories(userRole);

  const sections = await Promise.all(
    topLevel.map(async (cat) => {
      const subcategories = await getSubcategoriesOf(cat.slug, userRole);
      if (subcategories.length > 0) {
        const subcatDocs = await Promise.all(
          subcategories.map(async (sub) => ({
            sub,
            docs: await getDocsByCategory(sub.slug, userRole),
          }))
        );
        return { cat, subcategories: subcatDocs, docs: [] as DocMeta[] };
      }
      const docs = await getDocsByCategory(cat.slug, userRole);
      return { cat, subcategories: [], docs };
    })
  );

  const allDocs = sections.flatMap(({ subcategories, docs }) => [
    ...docs,
    ...subcategories.flatMap(({ docs: subDocs }) => subDocs),
  ]);
  const allTags = [...new Set(allDocs.flatMap((d) => d.tags ?? []))].sort();

  const filteredSections = tagFilter
    ? sections
        .map(({ cat, subcategories, docs }) => ({
          cat,
          docs: docs.filter((d) => d.tags?.includes(tagFilter)),
          subcategories: subcategories
            .map(({ sub, docs: subDocs }) => ({
              sub,
              docs: subDocs.filter((d) => d.tags?.includes(tagFilter)),
            }))
            .filter(({ docs: subDocs }) => subDocs.length > 0),
        }))
        .filter(
          ({ docs, subcategories }) =>
            docs.length > 0 || subcategories.length > 0
        )
    : sections;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      {/* Header */}
      <div className="bg-brand-gradient rounded-2xl px-6 py-7 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="w-5 h-5 text-brand-700 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">Documentation</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Browse all available documentation by category
            </p>
          </div>
        </div>
        <SearchBar className="max-w-xl" />
      </div>

      <Suspense fallback={null}>
        <TagFilter tags={allTags} />
      </Suspense>

      <div className="space-y-8">
        {filteredSections.map(({ cat, subcategories, docs }) => {
          const SectionIcon = CATEGORY_ICONS[cat.icon] ?? BookOpenIcon;
          const sectionColor = CATEGORY_COLORS[cat.icon] ?? "var(--cat-shield)";
          if (subcategories.length > 0) {
            return (
              <div key={cat.slug}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: sectionColor }}
                  >
                    <SectionIcon className="w-3.5 h-3.5" style={{ color: "var(--icon-fg)" }} />
                  </span>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{cat.title}</h2>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#26262e] ml-1" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {subcategories.map(({ sub, docs: subDocs }) => (
                    <CategoryCard
                      key={sub.slug}
                      category={sub}
                      docCount={subDocs.length}
                      docTitles={subDocs.map((d) => d.title)}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={cat.slug} className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              <CategoryCard
                category={cat}
                docCount={docs.length}
                docTitles={docs.map((d) => d.title)}
              />
            </div>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600 text-sm">
          {tagFilter
            ? `No documents found with tag "${tagFilter}".`
            : "No documentation categories available for your role."}
        </div>
      )}
    </div>
  );
}
