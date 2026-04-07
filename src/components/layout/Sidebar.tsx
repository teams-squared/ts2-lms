"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Category, DocMeta } from "@/lib/types";
import { CATEGORY_ICONS, CATEGORY_COLORS, FileTextIcon, ChevronRightIcon } from "@/components/icons";
import RecentlyViewed from "@/components/docs/RecentlyViewed";

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
  const iconBg = CATEGORY_COLORS[category.icon] || "#f0e6ff";
  const indent = depth * 12;

  if (hasChildren) {
    return (
      <li className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          style={{ paddingLeft: `${12 + indent}px`, paddingRight: "12px" }}
        >
          {depth === 0 ? (
            <span
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "#4400FF" }} />
            </span>
          ) : null}
          <span className="flex-1 text-left">{category.title}</span>
          <ChevronRightIcon
            className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </button>

        {/* Tree connector line */}
        {open && (
          <span
            className="absolute w-px bg-gray-300"
            style={{
              left: `${12 + indent + (depth === 0 ? 10 : 6)}px`,
              top: "32px",
              bottom: "6px",
            }}
          />
        )}

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
        className={`flex items-center gap-2 py-1.5 rounded-r-lg text-sm transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700 font-medium border-l-[3px] border-brand-500"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent"
        }`}
        style={{ paddingLeft: `${12 + indent - (isActive ? 1 : 0)}px`, paddingRight: "12px" }}
      >
        {depth === 0 ? (
          <span
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "#4400FF" }} />
          </span>
        ) : null}
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
              In This Section
            </h3>
            <ul className="space-y-0.5">
              {docs.map((doc) => {
                const docPath = `/docs/${doc.category}/${doc.slug}`;
                const isActive = pathname === docPath;
                return (
                  <li key={doc.slug}>
                    <Link
                      href={docPath}
                      className={`flex items-center gap-2 py-1.5 rounded-r-lg text-sm transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700 font-medium border-l-[3px] border-brand-500"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent"
                      }`}
                      style={{ paddingLeft: `${12 - (isActive ? 1 : 0)}px`, paddingRight: "12px" }}
                    >
                      <FileTextIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{doc.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <RecentlyViewed />
      </div>
    </aside>
  );
}
