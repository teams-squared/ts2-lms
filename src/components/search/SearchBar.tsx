"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMac, setIsMac] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    const fuse = new Fuse(docs, {
      keys: ["title", "description", "tags"],
      threshold: 0.4,
    });

    const found = fuse.search(query).map((r) => r.item);
    const sliced = found.slice(0, 8);
    setResults(sliced);

  }, [query, docs]);

  // Reset selected index when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(-1);
  }, [results]);

  // Click-outside to close
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

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      const doc = results[selectedIndex];
      if (doc) {
        router.push(`/docs/${doc.category}/${doc.slug}`);
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(-1);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }

  const showDropdown = isOpen && (results.length > 0 || error || loading);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
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
          onKeyDown={handleInputKeyDown}
          placeholder="Search documentation..."
          className="w-full pl-10 pr-20 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-card transition-shadow"
        />
        {!query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-400 font-mono pointer-events-none">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div
          id="search-listbox"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full mt-1.5 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden z-50 text-left"
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
          {!loading && !error && results.map((doc, idx) => (
            <Link
              key={`${doc.category}/${doc.slug}`}
              href={`/docs/${doc.category}/${doc.slug}`}
              role="option"
              aria-selected={idx === selectedIndex}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
                setSelectedIndex(-1);
              }}
              className={`flex items-start gap-2.5 px-3 py-2 transition-colors border-b border-gray-50 last:border-b-0 border-l-2 ${
                idx === selectedIndex
                  ? "bg-brand-50 border-l-brand-400"
                  : "border-l-transparent hover:bg-gray-50 hover:border-l-brand-400"
              }`}
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
