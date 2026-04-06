"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { DocMeta } from "@/lib/types";
import { SearchIcon, FileTextIcon } from "@/components/icons";

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = "" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocMeta[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/search")
      .then((res) => {
        if (!res.ok) throw new Error(`Search API returned ${res.status}`);
        return res.json();
      })
      .then((data) => setDocs(data))
      .catch((err) => {
        console.error("Search failed to load:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
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

  const showDropdown = isOpen && (results.length > 0 || error || loading);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          role="combobox"
          aria-label="Search documentation"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="search-listbox"
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

      {showDropdown && (
        <div
          id="search-listbox"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full mt-1.5 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-50"
        >
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">
              Loading search index…
            </div>
          )}
          {!loading && error && (
            <div className="px-4 py-3 text-sm text-red-500">
              Search unavailable — please try again later.
            </div>
          )}
          {!loading && !error && results.map((doc) => (
            <Link
              key={`${doc.category}/${doc.slug}`}
              href={`/docs/${doc.category}/${doc.slug}`}
              role="option"
              aria-selected={false}
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
