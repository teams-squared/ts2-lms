"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Category, DocMeta } from "@/lib/types";
import { CATEGORY_ICONS, FileTextIcon, ChevronRightIcon } from "@/components/icons";

interface SidebarProps {
  categories: Category[];
  currentCategory?: string;
  docs?: DocMeta[];
}

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

function buildTree(categories: Category[], parentSlug?: string): CategoryNode[] {
  return categories
    .filter((c) => c.parentCategory === parentSlug)
    .map((c) => ({
      category: c,
      children: buildTree(categories, c.slug),
    }));
}

function containsSlug(nodes: CategoryNode[], slug: string): boolean {
  for (const node of nodes) {
    if (node.category.slug === slug) return true;
    if (containsSlug(node.children, slug)) return true;
  }
  return false;
}

interface NodeItemProps {
  node: CategoryNode;
  currentCategory?: string;
  depth: number;
}

function NodeItem({ node, currentCategory, depth }: NodeItemProps) {
  const { category, children } = node;
  const hasChildren = children.length > 0;
  const isActive = currentCategory === category.slug;
  const defaultOpen = isActive || containsSlug(children, currentCategory ?? "");
  const [open, setOpen] = useState(defaultOpen);

  const Icon = CATEGORY_ICONS[category.icon] || FileTextIcon;
  const indent = depth * 12;

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {depth === 0 && <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />}
          <span className="flex-1 text-left">{category.title}</span>
          <ChevronRightIcon
            className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </button>
        <div
          className="overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="min-h-0">
            <ul className="mt-0.5 space-y-0.5">
              {children.map((child) => (
                <NodeItem
                  key={child.category.slug}
                  node={child}
                  currentCategory={currentCategory}
                  depth={depth + 1}
                />
              ))}
            </ul>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/docs/${category.slug}`}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700 font-medium border-l-2 border-brand-500"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent"
        }`}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {depth === 0 && <Icon className="w-4 h-4 flex-shrink-0" />}
        <span>{category.title}</span>
      </Link>
    </li>
  );
}

export default function Sidebar({ categories, currentCategory, docs }: SidebarProps) {
  const pathname = usePathname();
  const tree = buildTree(categories);

  return (
    <aside className="w-56 flex-shrink-0 hidden md:block">
      <div className="sticky top-16 space-y-4 pr-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Categories
          </h3>
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <NodeItem
                key={node.category.slug}
                node={node}
                currentCategory={currentCategory}
                depth={0}
              />
            ))}
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
