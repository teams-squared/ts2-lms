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
              ? "bg-primary-subtle text-primary font-medium"
              : "text-foreground hover:bg-surface-muted"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => select(node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggle(node.id, e)}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-foreground-subtle hover:text-foreground"
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
          <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface text-sm px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
      >
        <span className={selectedName ? "text-foreground" : "text-foreground-subtle"}>
          {selectedName ?? "No node"}
        </span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
      </button>

      {/* Dropdown tree */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1">
          {/* "No node" option */}
          <div
            className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm ${
              !value
                ? "bg-primary-subtle text-primary font-medium"
                : "text-foreground-muted hover:bg-surface-muted"
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
