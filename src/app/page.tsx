import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getTopLevelCategories,
  getDocsByCategory,
  getSubcategoriesOf,
  getCategoryBySlug,
} from "@/lib/docs";
import SearchBar from "@/components/search/SearchBar";
import CategoryCard from "@/components/docs/CategoryCard";
import Logo from "@/components/Logo";
import ProgressRing from "@/components/dashboard/ProgressRing";
import ContinueLearningCard from "@/components/dashboard/ContinueLearningCard";
import { getUserProgress } from "@/lib/progress-store";
import type { DocMeta, Role } from "@/lib/types";

export default async function HomePage() {
  const session = await auth();
  const userRole = (session?.user?.role as Role) || "employee";
  const topLevel = session ? await getTopLevelCategories(userRole) : [];

  const userEmail = session?.user?.email;
  const userProgress = userEmail ? getUserProgress(userEmail) : null;

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

  // Compute overall progress
  const allDocs: DocMeta[] = categoryDocs.flatMap(({ docs }) => docs);
  const totalDocs = allDocs.length;
  const completedDocs = userProgress
    ? allDocs.filter((d) => {
        const dp = userProgress.docs[`${d.category}/${d.slug}`];
        return dp?.completedAt != null;
      }).length
    : 0;

  // Find next incomplete doc for "Continue Learning"
  let nextDoc: DocMeta | null = null;
  for (const { docs } of categoryDocs) {
    for (const doc of docs) {
      const dp = userProgress?.docs[`${doc.category}/${doc.slug}`];
      if (!dp?.completedAt) {
        nextDoc = doc;
        break;
      }
    }
    if (nextDoc) break;
  }
  const nextDocCategory = nextDoc
    ? await getCategoryBySlug(nextDoc.category)
    : null;

  const firstName = session.user?.name?.split(" ")[0] || "there";
  const streakDays = userProgress?.streak.currentStreak ?? 0;

  // Logged-in LMS dashboard
  return (
    <div>
      {/* Hero — welcome banner with progress ring */}
      <section className="bg-brand-gradient py-10 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing completed={completedDocs} total={totalDocs} size={110} />
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              You&apos;ve completed {completedDocs} of {totalDocs} units.
              {streakDays > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  {streakDays} day streak
                </span>
              )}
            </p>
            <div className="mt-4">
              <SearchBar className="max-w-md" />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Continue Learning */}
        {nextDoc && nextDocCategory && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Continue Learning
            </h2>
            <ContinueLearningCard doc={nextDoc} category={nextDocCategory} />
          </section>
        )}

        {/* Learning Paths */}
        {categoryDocs.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Learning Paths
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categoryDocs.map(({ cat, docs }) => {
                const completedCount = userProgress
                  ? docs.filter((d) => {
                      const dp = userProgress.docs[`${d.category}/${d.slug}`];
                      return dp?.completedAt != null;
                    }).length
                  : undefined;
                return (
                  <CategoryCard
                    key={cat.slug}
                    category={cat}
                    docCount={docs.length}
                    docTitles={docs.map((d) => d.title)}
                    completedCount={completedCount}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
