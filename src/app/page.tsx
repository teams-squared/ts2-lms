import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAccessibleCategories, getDocsByCategory } from "@/lib/docs";
import Logo from "@/components/Logo";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import type { Role } from "@/lib/types";

export default async function HomePage() {
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";
  const categories = session ? getAccessibleCategories(userRole) : [];

  return (
    <div>
      {/* Hero section */}
      <section className="bg-brand-gradient py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Logo size={64} showText={false} className="justify-center mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Teams Squared{" "}
            <span style={{ color: "#4400FF" }}>Documentation</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Your central hub for company guides, processes, and resources.
            Everything you need for day-to-day work, all in one place.
          </p>

          {session ? (
            <SearchBar className="max-w-xl mx-auto" />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
            >
              Sign In to Access Docs
            </Link>
          )}
        </div>
      </section>

      {/* Categories grid */}
      {session && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Browse by Category
          </h2>
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
        </section>
      )}

      {/* Not signed in CTA */}
      {!session && (
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="text-3xl mb-3">{"\u{1F4DA}"}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Organized Docs
              </h3>
              <p className="text-sm text-gray-500">
                Find what you need quickly with categorized documentation
              </p>
            </div>
            <div className="p-6">
              <div className="text-3xl mb-3">{"\u{1F50D}"}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Fast Search
              </h3>
              <p className="text-sm text-gray-500">
                Search across all documents instantly with fuzzy matching
              </p>
            </div>
            <div className="p-6">
              <div className="text-3xl mb-3">{"\u{1F512}"}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Role-Based Access
              </h3>
              <p className="text-sm text-gray-500">
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
