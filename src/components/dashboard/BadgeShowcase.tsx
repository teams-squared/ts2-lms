"use client";

import { useProgress } from "@/components/providers/ProgressProvider";
import { getAllBadgeDefinitions } from "@/lib/badges";

export default function BadgeShowcase() {
  const { progress } = useProgress();
  const allDefs = getAllBadgeDefinitions();
  const earnedIds = new Set(progress.badges.map((b) => b.id));

  // Combine static defs with dynamic category champions from progress
  const dynamicBadges = progress.badges.filter((b) =>
    b.id.startsWith("champion-")
  );
  const displayBadges = [
    ...allDefs,
    ...dynamicBadges
      .filter((b) => !allDefs.some((d) => d.id === b.id))
      .map(({ id, name, description, icon }) => ({ id, name, description, icon })),
  ];

  if (displayBadges.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Badges
      </h2>
      <div className="flex flex-wrap gap-3">
        {displayBadges.map((badge) => {
          const earned = earnedIds.has(badge.id);
          const earnedBadge = progress.badges.find((b) => b.id === badge.id);
          return (
            <div
              key={badge.id}
              className={`relative group flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                earned
                  ? "border-brand-200 dark:border-brand-800 bg-white dark:bg-[#1c1c24] shadow-card"
                  : "border-gray-200 dark:border-[#2e2e3a] bg-gray-50 dark:bg-[#16161e] opacity-50"
              }`}
              style={{ width: "80px" }}
            >
              <span
                className="text-2xl"
                dangerouslySetInnerHTML={{
                  __html: earned ? badge.icon : "&#10067;",
                }}
              />
              <span
                className={`text-[10px] text-center leading-tight font-medium ${
                  earned
                    ? "text-gray-700 dark:text-gray-300"
                    : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {earned ? badge.name : "???"}
              </span>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {earned
                  ? `${badge.description} — earned ${new Date(
                      earnedBadge!.earnedAt
                    ).toLocaleDateString()}`
                  : badge.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
