import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getSubcategoriesOf,
  getDocsByCategory,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import TagFilter from "@/components/docs/TagFilter";
import {
  BookOpenIcon,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  CATEGORY_ACCENT_COLORS,
  ChevronRightIcon,
  FileTextIcon,
  LockIcon,
} from "@/components/icons";
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

  // For every top-level category, gather all docs — both direct children and
  // docs from any subcategories — so they can all be listed in one flat section.
  const sections = await Promise.all(
    topLevel.map(async (cat) => {
      const subcategories = await getSubcategoriesOf(cat.slug, userRole);
      let docs: DocMeta[];
      if (subcategories.length > 0) {
        const subDocArrays = await Promise.all(
          subcategories.map((sub) => getDocsByCategory(sub.slug, userRole))
        );
        docs = subDocArrays.flat();
      } else {
        docs = await getDocsByCategory(cat.slug, userRole);
      }
      return { cat, docs };
    })
  );

  const allDocs = sections.flatMap(({ docs }) => docs);
  const allTags = [...new Set(allDocs.flatMap((d) => d.tags ?? []))].sort();

  const filteredSections = sections
    .map(({ cat, docs }) => ({
      cat,
      docs: tagFilter ? docs.filter((d) => d.tags?.includes(tagFilter)) : docs,
    }))
    .filter(({ docs }) => docs.length > 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      {/* Header */}
      <div className="bg-brand-gradient rounded-2xl px-6 py-7 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="w-5 h-5 text-brand-700 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              Documentation
            </h1>
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
        {filteredSections.map(({ cat, docs }) => {
          const SectionIcon = CATEGORY_ICONS[cat.icon] ?? BookOpenIcon;
          const sectionColor = CATEGORY_COLORS[cat.icon] ?? "var(--cat-shield)";
          const accentColor = CATEGORY_ACCENT_COLORS[cat.icon] ?? "#a78bfa";

          return (
            <div key={cat.slug}>
              {/* Section header */}
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: sectionColor }}
                >
                  <SectionIcon
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--icon-fg)" }}
                  />
                </span>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {cat.title}
                </h2>
                <div className="flex-1 h-px bg-gray-100 dark:bg-[#26262e] ml-1" />
              </div>

              {/* Document list */}
              <div className="space-y-2">
                {docs.map((doc) => (
                  <Link
                    key={`${doc.category}-${doc.slug}`}
                    href={`/docs/${doc.category}/${doc.slug}`}
                    className="flex items-stretch rounded-lg border border-gray-200/60 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-150 group overflow-hidden"
                  >
                    {/* Left category colour accent */}
                    <div
                      className="w-1 flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    />

                    <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
                      <FileTextIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 group-hover:text-brand-400 transition-colors" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {doc.title}
                        </h3>
                        {doc.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {doc.description}
                          </p>
                        )}
                        {/* Badges */}
                        {(doc.minRole !== "employee" ||
                          doc.passwordProtected ||
                          (doc.tags && doc.tags.length > 0)) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
                            {doc.tags &&
                              doc.tags.map((tag) => (
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
                      <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-400 flex-shrink-0 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600 text-sm">
          {tagFilter
            ? `No documents found with tag "${tagFilter}".`
            : "No documentation available for your role."}
        </div>
      )}
    </div>
  );
}
