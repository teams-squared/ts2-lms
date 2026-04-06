"use client";

import { useEffect, useRef, useState } from "react";

export interface TocHeading {
  depth: 1 | 2 | 3;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  headings: TocHeading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    elements.forEach((el) => observerRef.current!.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="hidden xl:block w-48 flex-shrink-0 sticky top-16 self-start max-h-[calc(100vh-5rem)] overflow-y-auto"
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        On this page
      </p>
      <ul className="space-y-1">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          const indent =
            heading.depth === 1 ? "" : heading.depth === 2 ? "pl-3" : "pl-6";
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={`block text-xs py-0.5 transition-colors ${indent} ${
                  isActive
                    ? "text-brand-700 font-medium"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
