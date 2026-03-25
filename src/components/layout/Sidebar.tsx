"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category, DocMeta } from "@/lib/types";

const ICONS: Record<string, string> = {
  rocket: "\u{1F680}",
  code: "\u{1F4BB}",
  briefcase: "\u{1F4BC}",
  book: "\u{1F4D6}",
  shield: "\u{1F6E1}",
  gear: "\u2699\uFE0F",
};

interface SidebarProps {
  categories: Category[];
  currentCategory?: string;
  docs?: DocMeta[];
}

export default function Sidebar({
  categories,
  currentCategory,
  docs,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block">
      <div className="sticky top-20 space-y-6 pr-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Categories
          </h3>
          <ul className="space-y-1">
            {categories.map((cat) => {
              const isActive = currentCategory === cat.slug;
              return (
                <li key={cat.slug}>
                  <Link
                    href={`/docs/${cat.slug}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span>{ICONS[cat.icon] || "\u{1F4C4}"}</span>
                    {cat.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {currentCategory && docs && docs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Documents
            </h3>
            <ul className="space-y-1">
              {docs.map((doc) => {
                const docPath = `/docs/${doc.category}/${doc.slug}`;
                const isActive = pathname === docPath;
                return (
                  <li key={doc.slug}>
                    <Link
                      href={docPath}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {doc.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
