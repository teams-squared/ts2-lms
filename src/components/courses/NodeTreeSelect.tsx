"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
} from "@/components/icons";

export interface NodeTreeItem {
  id: string;
  name: string;
  children: NodeTreeItem[];
}

interface NodeTreeSelectProps {
  nodes: NodeTreeItem[];
  value: string | null;
  onChange: (nodeId: string | null) => void;
}

/** Find the name of a node by ID (recursive) */
function findNodeName(nodes: NodeTreeItem[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name;
    const found = findNodeName(n.children, id);
    if (found) return found;
  }
  return null;
}

/** Find ancestor IDs of a target node so we can auto-expand the path */
function findAncestorIds(nodes: NodeTreeItem[], targetId: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return path;
    const found = findAncestorIds(n.children, targetId, [...path, n.id]);
    if (found) return found;
  }
  return null;
}

export function NodeTreeSelect({ nodes, value, onChange }: NodeTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!value) return new Set<string>();
    const ancestors = findAncestorIds(nodes, value);
    return new Set(ancestors ?? []);
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  const selectedName = value ? findNodeName(nodes, value) : null;

  const renderNode = (node: NodeTreeItem, depth: number) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = value === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm ${
            isSelected
              ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-medium"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => select(node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggle(node.id, e)}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <svg className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="truncate">{node.name}</span>
        </div>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#18181f] text-sm px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
      >
        <span className={selectedName ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {selectedName ?? "No node"}
        </span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {/* Dropdown tree */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-lg p-1">
          {/* "No node" option */}
          <div
            className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm ${
              !value
                ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-medium"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
            }`}
            onClick={() => select(null)}
          >
            <span className="w-4" />
            <span>No node</span>
          </div>

          {nodes.map((node) => renderNode(node, 0))}
        </div>
      )}
    </div>
  );
}
