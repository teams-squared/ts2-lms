import Link from "next/link";
import { auth } from "@/lib/auth";
import { getTopLevelCategories, getDocsByCategory } from "@/lib/docs";
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
        topLevel.map(async (cat) => ({
          cat,
          docs: await getDocsByCategory(cat.slug, userRole),
        }))
      )
    : [];

  return (
    <div>
      {/* Hero section */}
      <section className="bg-brand-gradient py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Teams Squared{" "}
            <span style={{ color: "#4400FF" }}>Documentation</span>
          </h1>
          <p className="text-base text-gray-600 mb-6 max-w-2xl mx-auto">
            Your central hub for company guides, processes, and resources.
          </p>

          {session ? (
            <SearchBar className="max-w-xl mx-auto" />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
            >
              Sign In to Access Docs
            </Link>
          )}
        </div>
      </section>

      {/* Categories grid */}
      {session && categoryDocs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            Browse by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Not signed in features */}
      {!session && (
        <section className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mx-auto mb-3 text-brand-500">
                <BookOpenIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Organized Docs
              </h3>
              <p className="text-xs text-gray-500">
                Find what you need quickly with categorized documentation
              </p>
            </div>
            <div className="p-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mx-auto mb-3 text-brand-500">
                <SearchIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Fast Search
              </h3>
              <p className="text-xs text-gray-500">
                Search across all documents instantly with fuzzy matching
              </p>
            </div>
            <div className="p-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mx-auto mb-3 text-brand-500">
                <LockIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Role-Based Access
              </h3>
              <p className="text-xs text-gray-500">
                Secure access control ensures the right people see the right
                docs
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
