"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { DocMeta } from "@/lib/types";
import { SearchIcon, FileTextIcon } from "@/components/icons";
import { posthog } from "@/lib/posthog-client";

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = "" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocMeta[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/search")
      .then((res) => res.json())
      .then((data) => setDocs(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim() || docs.length === 0) {
      setResults([]);
      return;
    }

    const fuse = new Fuse(docs, {
      keys: ["title", "description", "tags"],
      threshold: 0.4,
    });

    const found = fuse.search(query).map((r) => r.item);
    setResults(found.slice(0, 8));
  }, [query, docs]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      posthog.capture("search_performed", {
        query: query.trim(),
        result_count: results.length,
        has_results: results.length > 0,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [query, results]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search documentation..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-card transition-shadow"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1.5 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-50">
          {results.map((doc) => (
            <Link
              key={`${doc.category}/${doc.slug}`}
              href={`/docs/${doc.category}/${doc.slug}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 border-l-2 border-l-transparent hover:border-l-brand-400"
            >
              <FileTextIcon className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {doc.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
