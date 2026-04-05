"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function DocSearch() {
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const marksRef = useRef<HTMLElement[]>([]);
  const currentIndexRef = useRef(0);

  const clearHighlights = useCallback(() => {
    for (const mark of marksRef.current) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
        parent.normalize();
      }
    }
    marksRef.current = [];
  }, []);

  const applyHighlights = useCallback((searchQuery: string) => {
    clearHighlights();

    if (!searchQuery.trim()) {
      setMatchCount(0);
      setCurrentMatch(0);
      currentIndexRef.current = 0;
      return;
    }

    const container = document.getElementById("doc-content");
    if (!container) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      // Skip text inside <mark> elements we injected (shouldn't happen after clear, but be safe)
      if ((node.parentElement as HTMLElement)?.tagName === "MARK") continue;
      textNodes.push(node as Text);
    }

    const marks: HTMLElement[] = [];
    const lower = searchQuery.toLowerCase();

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      const lowerText = text.toLowerCase();
      if (!lowerText.includes(lower)) continue;

      const fragment = document.createDocumentFragment();
      let last = 0;
      let idx = lowerText.indexOf(lower);

      while (idx !== -1) {
        if (idx > last) {
          fragment.appendChild(document.createTextNode(text.slice(last, idx)));
        }
        const mark = document.createElement("mark");
        mark.className = "search-highlight";
        mark.textContent = text.slice(idx, idx + searchQuery.length);
        fragment.appendChild(mark);
        marks.push(mark);
        last = idx + searchQuery.length;
        idx = lowerText.indexOf(lower, last);
      }

      if (last < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(last)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }

    marksRef.current = marks;
    const count = marks.length;
    setMatchCount(count);

    if (count > 0) {
      currentIndexRef.current = 0;
      setCurrentMatch(1);
      marks[0].className = "search-highlight search-highlight-current";
      marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      currentIndexRef.current = 0;
      setCurrentMatch(0);
    }
  }, [clearHighlights]);

  useEffect(() => {
    const timer = setTimeout(() => applyHighlights(query), 150);
    return () => clearTimeout(timer);
  }, [query, applyHighlights]);

  // Clean up DOM on unmount
  useEffect(() => () => clearHighlights(), [clearHighlights]);

  function navigate(dir: 1 | -1) {
    const marks = marksRef.current;
    if (marks.length === 0) return;

    marks[currentIndexRef.current].className = "search-highlight";

    const next = (currentIndexRef.current + dir + marks.length) % marks.length;
    currentIndexRef.current = next;
    marks[next].className = "search-highlight search-highlight-current";
    marks[next].scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrentMatch(next + 1);
  }

  const noMatches = query.trim() !== "" && matchCount === 0;

  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search in document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
            if (e.key === "Escape") setQuery("");
          }}
          className={`pl-8 pr-3 py-1.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-1 transition-colors w-56 ${
            noMatches
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-gray-200 focus:border-brand-400 focus:ring-brand-100"
          }`}
        />
      </div>

      {matchCount > 0 && (
        <>
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {currentMatch} / {matchCount}
          </span>
          <button
            onClick={() => navigate(-1)}
            title="Previous match (Shift+Enter)"
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigate(1)}
            title="Next match (Enter)"
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setQuery("")}
            title="Clear search"
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {noMatches && (
        <span className="text-xs text-red-400">No matches</span>
      )}
    </div>
  );
}
