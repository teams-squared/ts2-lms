import { getOrgProgress } from "@/lib/progress-store";
import { getAllDocs, getCategories } from "@/lib/docs";
import ProgressBar from "@/components/ui/ProgressBar";

export default async function AdminProgressPage() {
  const [orgProgress, allDocs, categories] = await Promise.all([
    getOrgProgress(),
    getAllDocs(),
    getCategories(),
  ]);

  const totalDocs = allDocs.length;

  // Per-user stats
  const userStats = orgProgress.map(({ email, progress }) => {
    const docsCompleted = Object.values(progress.docs).filter(
      (d) => d.completedAt !== null
    ).length;
    const quizzesPassed = Object.values(progress.docs).filter(
      (d) => d.quizPassedAt !== null
    ).length;
    const badgeCount = progress.badges.length;
    const lastActive = progress.lastSyncedAt
      ? new Date(progress.lastSyncedAt).toLocaleDateString()
      : "Never";
    return { email, docsCompleted, quizzesPassed, badgeCount, lastActive };
  });

  // Org-wide completion rate
  const totalCompletions = userStats.reduce(
    (sum, u) => sum + u.docsCompleted,
    0
  );
  const totalPossible = userStats.length * totalDocs;
  const orgCompletionRate =
    totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;

  // Per-category completion
  const categoryStats = categories
    .filter((cat) => !cat.parentCategory)
    .map((cat) => {
      const catDocs = allDocs.filter((d) => d.category === cat.slug);
      // Also include subcategory docs
      const subCats = categories.filter((c) => c.parentCategory === cat.slug);
      const subDocs = allDocs.filter((d) =>
        subCats.some((sc) => sc.slug === d.category)
      );
      const allCatDocs = [...catDocs, ...subDocs];
      if (allCatDocs.length === 0) return null;

      let completedAcrossUsers = 0;
      for (const { progress } of orgProgress) {
        for (const doc of allCatDocs) {
          const dp = progress.docs[`${doc.category}/${doc.slug}`];
          if (dp?.completedAt) completedAcrossUsers++;
        }
      }
      const totalPossible = allCatDocs.length * (orgProgress.length || 1);
      return {
        title: cat.title,
        docCount: allCatDocs.length,
        completionRate: Math.round((completedAcrossUsers / totalPossible) * 100),
      };
    })
    .filter(Boolean) as { title: string; docCount: number; completionRate: number }[];

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { value: orgProgress.length, label: "Active Learners" },
          { value: `${orgCompletionRate}%`, label: "Org Completion Rate" },
          {
            value: userStats.reduce((sum, u) => sum + u.quizzesPassed, 0),
            label: "Quizzes Passed",
          },
          {
            value: userStats.reduce((sum, u) => sum + u.badgeCount, 0),
            label: "Badges Earned",
          },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card"
          >
            <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums mb-1">
              {value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 font-medium">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Per-category completion */}
      {categoryStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Completion by Category
          </h2>
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card divide-y divide-gray-100 dark:divide-[#26262e]">
            {categoryStats.map((stat) => (
              <div key={stat.title} className="px-5 py-3 flex items-center gap-4">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium w-48 flex-shrink-0">
                  {stat.title}
                </span>
                <div className="flex-1">
                  <ProgressBar
                    completed={stat.completionRate}
                    total={100}
                    showLabel={false}
                    size="sm"
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-500 tabular-nums w-12 text-right">
                  {stat.completionRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-user table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Learner Progress
        </h2>
        {userStats.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No learner activity yet.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#18181f] text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    User
                  </th>
                  <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">
                    Docs
                  </th>
                  <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">
                    Quizzes
                  </th>
                  <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">
                    Badges
                  </th>
                  <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#26262e]">
                {userStats.map((user) => (
                  <tr
                    key={user.email}
                    className="hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-200">
                      {user.email}
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums">
                      <span className="text-gray-700 dark:text-gray-300">
                        {user.docsCompleted}
                      </span>
                      <span className="text-gray-400 dark:text-gray-600">
                        /{totalDocs}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                      {user.quizzesPassed}
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700 dark:text-gray-300">
                      {user.badgeCount}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500 dark:text-gray-500">
                      {user.lastActive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
