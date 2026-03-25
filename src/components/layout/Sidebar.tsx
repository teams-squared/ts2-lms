"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category, DocMeta } from "@/lib/types";
import { CATEGORY_ICONS, FileTextIcon } from "@/components/icons";

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
    <aside className="w-56 flex-shrink-0 hidden md:block">
      <div className="sticky top-16 space-y-4 pr-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Categories
          </h3>
          <ul className="space-y-0.5">
            {categories.map((cat) => {
              const isActive = currentCategory === cat.slug;
              const Icon = CATEGORY_ICONS[cat.icon] || FileTextIcon;
              return (
                <li key={cat.slug}>
                  <Link
                    href={`/docs/${cat.slug}`}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700 font-medium border-l-2 border-brand-500"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {currentCategory && docs && docs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Documents
            </h3>
            <ul className="space-y-0.5">
              {docs.map((doc) => {
                const docPath = `/docs/${doc.category}/${doc.slug}`;
                const isActive = pathname === docPath;
                return (
                  <li key={doc.slug}>
                    <Link
                      href={docPath}
                      className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
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
