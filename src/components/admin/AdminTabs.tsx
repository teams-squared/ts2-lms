"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const TABS = [
  { href: "/admin", label: "Overview", exact: true, adminOnly: false },
  { href: "/admin/users", label: "Users", exact: false, adminOnly: true },
  { href: "/admin/courses", label: "Courses", exact: false, adminOnly: false },
  { href: "/admin/nodes", label: "Nodes", exact: false, adminOnly: false },
  { href: "/admin/assignments", label: "Enrollments", exact: false, adminOnly: false },
  { href: "/admin/analytics", label: "Analytics", exact: false, adminOnly: false },
];

export function AdminTabs() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const visibleTabs = TABS.filter((t) => isAdmin || !t.adminOnly);

  return (
    <nav className="flex gap-1 mb-6 border-b border-gray-200 dark:border-[#2e2e3a]">
      {visibleTabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
