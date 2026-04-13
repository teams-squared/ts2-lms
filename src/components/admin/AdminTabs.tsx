"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/admin" },
  { label: "Progress", href: "/admin/progress" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Content", href: "/admin/content" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200 dark:border-[#2e2e3a] mb-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              active
                ? "text-brand-700 dark:text-brand-300 border-b-2 border-brand-600 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-950/30"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
