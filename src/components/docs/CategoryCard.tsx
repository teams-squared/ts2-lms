import Link from "next/link";
import type { Category } from "@/lib/types";
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_ACCENT_COLORS, FileTextIcon, ChevronRightIcon, LockIcon } from "@/components/icons";

interface CategoryCardProps {
  category: Category;
  docCount: number;
  docTitles?: string[];
}

export default function CategoryCard({
  category,
  docCount,
  docTitles,
}: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[category.icon] || FileTextIcon;
  const iconBg = CATEGORY_COLORS[category.icon] || "var(--cat-shield)";
  const accentColor = CATEGORY_ACCENT_COLORS[category.icon] || "#a78bfa";
  const visibleTitles = docTitles?.slice(0, 5) || [];
  const remaining = (docTitles?.length || 0) - visibleTitles.length;

  return (
    <Link href={`/docs/${category.slug}`} className="block group">
      <div className="relative rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-200 dark:hover:border-brand-800 hover:-translate-y-0.5 transition-all duration-150 overflow-hidden h-full">
        {/* Accent strip */}
        <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />

        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: "var(--icon-fg)" }} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {category.minRole !== "employee" && (
                <span
                  className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full"
                  title={`${category.minRole === "admin" ? "Admin" : "Manager"} access required`}
                >
                  <LockIcon className="w-2.5 h-2.5" />
                  {category.minRole}
                </span>
              )}
              <span className="text-[10px] text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#2a2a35] px-1.5 py-0.5 rounded-full tabular-nums">
                {docCount} {docCount === 1 ? "doc" : "docs"}
              </span>
              <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-400 dark:group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-snug">
            {category.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 leading-relaxed">
            {category.description}
          </p>

          {visibleTitles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#26262e] space-y-1.5">
              {visibleTitles.map((title) => (
                <div key={title} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
                  <FileTextIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{title}</span>
                </div>
              ))}
              {remaining > 0 && (
                <div className="text-xs text-gray-300 dark:text-gray-700 pl-[18px]">
                  +{remaining} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
