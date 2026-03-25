import { auth } from "@/lib/auth";
import { getAccessibleCategories, getDocsByCategory } from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import type { Role } from "@/lib/types";

export default async function DocsPage() {
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";
  const categories = getAccessibleCategories(userRole);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Documentation
        </h1>
        <p className="text-gray-500 mb-6">
          Browse all available documentation by category
        </p>
        <SearchBar className="max-w-xl" />
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const docs = getDocsByCategory(cat.slug, userRole);
          return (
            <CategoryCard
              key={cat.slug}
              category={cat}
              docCount={docs.length}
            />
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          No documentation categories available for your role.
        </div>
      )}
    </div>
  );
}
