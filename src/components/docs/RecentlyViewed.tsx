"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "recently-viewed-docs";
const MAX_ENTRIES = 6;

interface RecentEntry {
  title: string;
  href: string;
  visitedAt: number;
}

function getEntries(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function addEntry(entry: Omit<RecentEntry, "visitedAt">): void {
  const entries = getEntries().filter((e) => e.href !== entry.href);
  entries.unshift({ ...entry, visitedAt: Date.now() });
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_ENTRIES))
  );
}

// Null-render component that records a doc visit on mount.
export function DocVisitRecorder({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  useEffect(() => {
    addEntry({ title, href });
  }, [title, href]);

  return null;
}

// Sidebar section that shows the last N visited docs.
export default function RecentlyViewed() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(getEntries());
    setMounted(true);
  }, [pathname]); // re-read when pathname changes so list stays fresh

  if (!mounted || entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2 px-3">
        Recently Viewed
      </h3>
      <ul className="space-y-0.5">
        {entries.map((entry) => {
          const isActive = pathname === entry.href;
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className={`block px-3 py-1.5 rounded-lg text-sm transition-colors truncate ${
                  isActive
                    ? "bg-brand-50 dark:bg-[#1a0d2e] text-brand-700 dark:text-brand-300 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1e1e28] hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title={entry.title}
              >
                {entry.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
