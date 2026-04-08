import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getDocsByCategory,
  getSubcategoriesOf,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import { BookOpenIcon, SearchIcon, LockIcon } from "@/components/icons";
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

          {session ? (
            <SearchBar className="max-w-xl mx-auto" />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/30 text-sm"
            >
              Sign In to Access Docs
            </Link>
          )}
        </div>
      </section>

      {/* Categories grid */}
      {session && categoryDocs.length > 0 && (
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

      {/* Not signed in — feature highlights */}
      {!session && (
        <section className="max-w-3xl mx-auto px-4 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: BookOpenIcon,
                title: "Organized Docs",
                desc: "Find what you need quickly with categorized documentation",
              },
              {
                icon: SearchIcon,
                title: "Fast Search",
                desc: "Search across all documents instantly with fuzzy matching",
              },
              {
                icon: LockIcon,
                title: "Role-Based Access",
                desc: "Secure access control ensures the right people see the right docs",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 text-center rounded-xl border border-gray-100 dark:border-[#26262e] bg-white dark:bg-[#1c1c24] shadow-card">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-[#1a0d2e] flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
