import Link from "next/link";
import type { Category } from "@/lib/types";

const ICONS: Record<string, string> = {
  rocket: "\u{1F680}",
  code: "\u{1F4BB}",
  briefcase: "\u{1F4BC}",
  book: "\u{1F4D6}",
  shield: "\u{1F6E1}",
  gear: "\u2699\uFE0F",
};

interface CategoryCardProps {
  category: Category;
  docCount: number;
}

export default function CategoryCard({
  category,
  docCount,
}: CategoryCardProps) {
  return (
    <Link href={`/docs/${category.slug}`}>
      <div className="group p-6 rounded-xl border border-gray-100 bg-white hover:border-brand-200 hover:shadow-md transition-all duration-200">
        <div className="text-3xl mb-3">
          {ICONS[category.icon] || "\u{1F4C4}"}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
          {category.title}
        </h3>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
          {category.description}
        </p>
        <div className="mt-3 text-xs text-gray-400">
          {docCount} {docCount === 1 ? "document" : "documents"}
        </div>
      </div>
    </Link>
  );
}
