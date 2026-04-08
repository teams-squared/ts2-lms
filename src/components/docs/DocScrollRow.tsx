"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
} from "@/components/icons";
import type { DocMeta } from "@/lib/types";

interface Props {
  docs: DocMeta[];
  accentColor: string;
}

const SCROLL_AMOUNT = 312; // card width (288) + gap (24)

export default function DocScrollRow({ docs, accentColor }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncArrows();
    const id = setTimeout(syncArrows, 100);
    return () => clearTimeout(id);
  }, [docs, syncArrows]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className={[
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20",
          "w-8 h-8 rounded-full bg-white dark:bg-[#1c1c24]",
          "border border-gray-200 dark:border-[#2e2e3a] shadow-md",
          "flex items-center justify-center",
          "text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400",
          "transition-all duration-150",
          canLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      {/* Scrollable card row */}
      <div
        ref={scrollRef}
        onScroll={syncArrows}
        className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {docs.map((doc) => (
          <Link
            key={`${doc.category}-${doc.slug}`}
            href={`/docs/${doc.category}/${doc.slug}`}
            className="flex-none w-72 rounded-xl border border-gray-200/60 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-150 group overflow-hidden flex flex-col"
          >
            {/* Top accent bar */}
            <div className="h-0.5 w-full flex-none" style={{ backgroundColor: accentColor }} />

            <div className="p-5 flex flex-col flex-1">
              {/* Title row */}
              <div className="flex items-start gap-2 mb-2.5">
                <FileTextIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mt-0.5 flex-none group-hover:text-brand-400 transition-colors" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2 leading-snug">
                  {doc.title}
                </h3>
              </div>

              {/* Description — 3 lines so more content is visible */}
              {doc.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-4 flex-1">
                  {doc.description}
                </p>
              )}

              {/* Badges */}
              {(doc.minRole !== "employee" ||
                doc.passwordProtected ||
                (doc.tags && doc.tags.length > 0)) && (
                <div className="flex flex-wrap gap-1 mt-auto">
                  {doc.minRole !== "employee" && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                      <LockIcon className="w-2.5 h-2.5" />
                      {doc.minRole}
                    </span>
                  )}
                  {doc.passwordProtected && (
                    <span className="flex items-center gap-0.5 text-[10px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-[#1a0d2e] px-1.5 py-0.5 rounded-full">
                      <LockIcon className="w-2.5 h-2.5" />
                      password
                    </span>
                  )}
                  {doc.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2e2e3a] text-gray-500 dark:text-gray-400 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Edge fade — left. Matches the page background so cards appear to dissolve into it. */}
      <div
        aria-hidden="true"
        className="absolute left-0 inset-y-0 w-16 pointer-events-none z-10 transition-opacity duration-200 bg-gradient-to-r from-[#f5f5f8] dark:from-[#0f0f14] to-transparent"
        style={{ opacity: canLeft ? 1 : 0 }}
      />

      {/* Edge fade — right */}
      <div
        aria-hidden="true"
        className="absolute right-0 inset-y-0 w-16 pointer-events-none z-10 transition-opacity duration-200 bg-gradient-to-l from-[#f5f5f8] dark:from-[#0f0f14] to-transparent"
        style={{ opacity: canRight ? 1 : 0 }}
      />

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className={[
          "absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20",
          "w-8 h-8 rounded-full bg-white dark:bg-[#1c1c24]",
          "border border-gray-200 dark:border-[#2e2e3a] shadow-md",
          "flex items-center justify-center",
          "text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400",
          "transition-all duration-150",
          canRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
