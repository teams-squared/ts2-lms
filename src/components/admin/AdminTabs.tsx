"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/admin" },
  { label: "Analytics", href: "/admin/analytics" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              active
                ? "text-brand-700 border-b-2 border-brand-600 bg-brand-50/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
