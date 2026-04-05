import Link from "next/link";
import type { Category } from "@/lib/types";
import { CATEGORY_ICONS, CATEGORY_COLORS, FileTextIcon, ChevronRightIcon } from "@/components/icons";

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
  const iconBg = CATEGORY_COLORS[category.icon] || "#f0e6ff";
  const visibleTitles = docTitles?.slice(0, 5) || [];
  const remaining = (docTitles?.length || 0) - visibleTitles.length;

  return (
    <Link href={`/docs/${category.slug}`}>
      <div className="group relative p-5 rounded-lg border border-gray-200/60 bg-white shadow-card hover:shadow-card-hover hover:border-brand-300 hover:scale-[1.01] transition-all duration-150">
        <div className="flex items-start justify-between mb-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: "#4400FF" }} />
          </div>
          <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
          {category.title}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {category.description}
        </p>

        {visibleTitles.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1">
            {visibleTitles.map((title) => (
              <div key={title} className="flex items-center gap-1.5 text-xs text-gray-400">
                <FileTextIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </div>
            ))}
            {remaining > 0 && (
              <div className="text-xs text-gray-300 pl-[18px]">
                +{remaining} more
              </div>
            )}
          </div>
        )}

        {visibleTitles.length === 0 && (
          <div className="mt-2 text-xs text-gray-400">
            {docCount} {docCount === 1 ? "document" : "documents"}
          </div>
        )}
      </div>
    </Link>
  );
}
