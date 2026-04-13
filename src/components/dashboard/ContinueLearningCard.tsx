import Link from "next/link";
import type { DocMeta, Category } from "@/lib/types";
import { CATEGORY_ICONS, CATEGORY_COLORS, FileTextIcon } from "@/components/icons";

interface ContinueLearningCardProps {
  doc: DocMeta;
  category: Category;
}

export default function ContinueLearningCard({
  doc,
  category,
}: ContinueLearningCardProps) {
  const Icon = CATEGORY_ICONS[category.icon] || FileTextIcon;
  const iconBg = CATEGORY_COLORS[category.icon] || "var(--cat-shield)";

  return (
    <Link
      href={`/docs/${doc.category}/${doc.slug}`}
      className="block group"
    >
      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-200 dark:hover:border-brand-800 hover:-translate-y-0.5 transition-all duration-150 overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: "var(--icon-fg)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-0.5">
              {category.title}
            </p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
              {doc.title}
            </h3>
            {doc.description && (
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 truncate">
                {doc.description}
              </p>
            )}
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium group-hover:bg-brand-700 transition-colors flex-shrink-0">
            Continue
          </span>
        </div>
      </div>
    </Link>
  );
}
