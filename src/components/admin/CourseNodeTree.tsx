"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  GraduationCapIcon,
} from "@/components/icons";
import type { NodeWithChildren } from "@/lib/courseNodes";

interface CourseNodeTreeProps {
  nodes: NodeWithChildren[];
  selectedCourseIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** When true, shows a search input above the tree that filters
   *  branches by node name or course title. Defaults to true since
   *  most callers benefit from it; pass false to suppress in tight
   *  layouts. */
  showSearch?: boolean;
}

/** Recursively filter the tree to nodes/courses matching `term`. A node
 *  is kept if its own name matches OR any descendant matches. When the
 *  node itself matches, the entire subtree is preserved (so the admin
 *  sees the full context); otherwise only matching descendants are kept. */
function filterTree(
  nodes: NodeWithChildren[],
  term: string,
): NodeWithChildren[] {
  if (!term) return nodes;
  const lower = term.toLowerCase();
  const out: NodeWithChildren[] = [];
  for (const node of nodes) {
    const nodeMatches = node.name.toLowerCase().includes(lower);
    const matchingCourses = node.courses.filter((c) =>
      c.title.toLowerCase().includes(lower),
    );
    const filteredChildren = filterTree(node.children, term);
    if (
      nodeMatches ||
      matchingCourses.length > 0 ||
      filteredChildren.length > 0
    ) {
      out.push({
        ...node,
        children: nodeMatches ? node.children : filteredChildren,
        courses: nodeMatches ? node.courses : matchingCourses,
      });
    }
  }
  return out;
}

/** Collect every node id in a tree (including descendants) so we can
 *  auto-expand the visible portion when filtering. */
function collectNodeIds(nodes: NodeWithChildren[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    ids.push(n.id);
    ids.push(...collectNodeIds(n.children));
  }
  return ids;
}

/** Collect all course IDs under a node (recursively) */
function collectCourseIds(node: NodeWithChildren): string[] {
  const ids = node.courses.map((c) => c.id);
  for (const child of node.children) {
    ids.push(...collectCourseIds(child));
  }
  return ids;
}

type CheckState = "checked" | "unchecked" | "indeterminate";

function getNodeCheckState(
  node: NodeWithChildren,
  selected: Set<string>,
): CheckState {
  const allIds = collectCourseIds(node);
  if (allIds.length === 0) return "unchecked";
  const checkedCount = allIds.filter((id) => selected.has(id)).length;
  if (checkedCount === 0) return "unchecked";
  if (checkedCount === allIds.length) return "checked";
  return "indeterminate";
}

export function CourseNodeTree({
  nodes,
  selectedCourseIds,
  onSelectionChange,
  showSearch = true,
}: CourseNodeTreeProps) {
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const visibleNodes = useMemo(
    () => filterTree(nodes, trimmedSearch),
    [nodes, trimmedSearch],
  );

  // Auto-expand any node that contains a selected course, so newly-mounted
  // forms with prior selections show those selections without the admin
  // hunting through the tree.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const ex = new Set<string>();
    function walk(nodeList: NodeWithChildren[]) {
      for (const n of nodeList) {
        const state = getNodeCheckState(n, selectedCourseIds);
        if (state !== "unchecked") ex.add(n.id);
        walk(n.children);
      }
    }
    walk(nodes);
    return ex;
  });

  // While a search term is active, every node in the filtered tree is
  // implicitly expanded — admins want to see the matches, not click into
  // each one. When the search is cleared, we fall back to the user's
  // expanded state from before the search.
  const effectiveExpanded = useMemo(() => {
    if (!trimmedSearch) return expanded;
    return new Set(collectNodeIds(visibleNodes));
  }, [trimmedSearch, expanded, visibleNodes]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleNode = useCallback(
    (node: NodeWithChildren) => {
      const allIds = collectCourseIds(node);
      const state = getNodeCheckState(node, selectedCourseIds);
      const next = new Set(selectedCourseIds);

      if (state === "checked") {
        // Uncheck all
        for (const id of allIds) next.delete(id);
      } else {
        // Check all
        for (const id of allIds) next.add(id);
        // Auto-expand when checking
        setExpanded((prev) => new Set(prev).add(node.id));
      }
      onSelectionChange(next);
    },
    [selectedCourseIds, onSelectionChange],
  );

  const toggleCourse = useCallback(
    (courseId: string) => {
      const next = new Set(selectedCourseIds);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      onSelectionChange(next);
    },
    [selectedCourseIds, onSelectionChange],
  );

  const renderCheckbox = (state: CheckState, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      style={{
        borderColor: state === "unchecked" ? "var(--border)" : "var(--primary)",
        backgroundColor: state !== "unchecked" ? "var(--primary)" : "transparent",
      }}
    >
      {state === "checked" && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-5" />
        </svg>
      )}
      {state === "indeterminate" && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6h8" />
        </svg>
      )}
    </button>
  );

  const renderNode = (node: NodeWithChildren, depth: number) => {
    const isExpanded = effectiveExpanded.has(node.id);
    const hasChildren = node.children.length > 0 || node.courses.length > 0;
    const checkState = getNodeCheckState(node, selectedCourseIds);
    const totalCourses = collectCourseIds(node).length;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 px-1 rounded hover:bg-surface-muted transition-colors"
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          {/* Expand/collapse */}
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="w-4 h-4 flex items-center justify-center text-foreground-subtle hover:text-foreground flex-shrink-0"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )
            ) : null}
          </button>

          {/* Checkbox */}
          {totalCourses > 0 && renderCheckbox(checkState, () => toggleNode(node))}

          {/* Folder icon + name */}
          <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-sm text-foreground truncate">
            {node.name}
          </span>
          {totalCourses > 0 && (
            <span className="text-xs text-foreground-subtle tabular-nums">
              ({totalCourses})
            </span>
          )}
        </div>

        {/* Children + courses */}
        {isExpanded && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-surface-muted transition-colors"
                style={{ paddingLeft: `${(depth + 1) * 20 + 4}px` }}
              >
                <span className="w-4" /> {/* spacer for alignment with expand button */}
                {renderCheckbox(
                  selectedCourseIds.has(course.id) ? "checked" : "unchecked",
                  () => toggleCourse(course.id),
                )}
                <GraduationCapIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
                <span className="text-sm text-foreground-muted truncate">
                  {course.title}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle py-4 text-center">
        No course nodes configured. Add nodes in the admin panel first.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {showSearch && (
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses or folders…"
            className="w-full px-3 py-2 pr-8 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            aria-label="Filter course tree"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1">
        {visibleNodes.length === 0 ? (
          <p className="text-xs text-foreground-subtle py-4 text-center">
            No nodes or courses match &ldquo;{trimmedSearch}&rdquo;.
          </p>
        ) : (
          visibleNodes.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
