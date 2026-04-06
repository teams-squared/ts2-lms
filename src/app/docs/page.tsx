import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getSubcategoriesOf,
  getDocsByCategory,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import { CATEGORY_ICONS, CATEGORY_COLORS, BookOpenIcon, FileTextIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

export default async function DocsPage() {
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
        return { cat, subcategories: subcatDocs, docs: [] };
      }
      const docs = await getDocsByCategory(cat.slug, userRole);
      return { cat, subcategories: [], docs };
    })
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      {/* Branded hero header */}
      <div className="bg-brand-gradient rounded-xl px-6 py-7 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Documentation</h1>
            <p className="text-sm text-white/70 mt-0.5">
              Browse all available documentation by category
            </p>
          </div>
        </div>
        <SearchBar className="max-w-xl" />
      </div>

      <div className="space-y-8">
        {sections.map(({ cat, subcategories, docs }) => {
          const SectionIcon = CATEGORY_ICONS[cat.icon] || FileTextIcon;
          const sectionColor = CATEGORY_COLORS[cat.icon] || "#f0e6ff";

          if (subcategories.length > 0) {
            return (
              <div key={cat.slug}>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: sectionColor }}
                  >
                    <SectionIcon className="w-3.5 h-3.5" style={{ color: "#4400FF" }} />
                  </span>
                  <h2 className="text-sm font-semibold text-gray-800">{cat.title}</h2>
                  <div className="flex-1 h-px bg-gray-100 ml-1" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
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
            <div key={cat.slug} className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
              <CategoryCard
                category={cat}
                docCount={docs.length}
                docTitles={docs.map((d) => d.title)}
              />
            </div>
          );
        })}
      </div>

      {topLevel.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No documentation categories available for your role.
        </div>
      )}
    </div>
  );
}
