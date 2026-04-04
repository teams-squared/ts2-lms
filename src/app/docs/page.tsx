import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getSubcategoriesOf,
  getDocsByCategory,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Documentation
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          Browse all available documentation by category
        </p>
        <SearchBar className="max-w-xl" />
      </div>

      <div className="space-y-8">
        {sections.map(({ cat, subcategories, docs }) => {
          if (subcategories.length > 0) {
            return (
              <div key={cat.slug}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {cat.title}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <CategoryCard
              key={cat.slug}
              category={cat}
              docCount={docs.length}
              docTitles={docs.map((d) => d.title)}
            />
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
