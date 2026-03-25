"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { DocMeta } from "@/lib/types";

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
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search documentation..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm transition-shadow"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
          {results.map((doc) => (
            <Link
              key={`${doc.category}/${doc.slug}`}
              href={`/docs/${doc.category}/${doc.slug}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="text-sm font-medium text-gray-900">
                {doc.title}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {doc.description}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
