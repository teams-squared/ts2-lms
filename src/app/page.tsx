import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getDocsByCategory,
  getSubcategoriesOf,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import Logo from "@/components/Logo";
import type { Role } from "@/lib/types";

export default async function HomePage() {
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";
  const topLevel = session ? await getTopLevelCategories(userRole) : [];

  const categoryDocs = session
    ? await Promise.all(
        topLevel.map(async (cat) => {
          const directDocs = await getDocsByCategory(cat.slug, userRole);
          if (directDocs.length > 0) {
            return { cat, docs: directDocs };
          }
          const subcategories = await getSubcategoriesOf(cat.slug, userRole);
          const subDocs = await Promise.all(
            subcategories.map((sub) => getDocsByCategory(sub.slug, userRole))
          );
          return { cat, docs: subDocs.flat() };
        })
      )
    : [];

  // Logged-out landing page — full-height centered screen
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f8] dark:bg-[#0f0f14]">
        <div className="w-full max-w-sm text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-2">
            <Logo size={48} showText={false} />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Teams Squared{" "}
              <span className="text-brand-600 dark:text-brand-400">Docs</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sign in with your Teams Squared account to access company documentation.
            </p>
          </div>

          {/* CTA */}
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-lg shadow-brand-600/25 text-sm"
          >
            Sign in
          </Link>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-xs text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} Teams Squared
        </p>
      </div>
    );
  }

  // Logged-in home page
  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-gradient py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
            Teams Squared{" "}
            <span className="text-brand-600 dark:text-brand-400">Documentation</span>
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Your central hub for company guides, processes, and resources.
          </p>
          <SearchBar className="max-w-xl mx-auto" />
        </div>
      </section>

      {/* Categories grid */}
      {categoryDocs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">
            Browse by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categoryDocs.map(({ cat, docs }) => (
              <CategoryCard
                key={cat.slug}
                category={cat}
                docCount={docs.length}
                docTitles={docs.map((d) => d.title)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
