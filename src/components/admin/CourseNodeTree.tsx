"use client";

import { useState, useCallback } from "react";
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
}: CourseNodeTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand nodes that have selected courses
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
      className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500"
      style={{
        borderColor: state === "unchecked" ? "var(--color-gray-300)" : "var(--color-brand-600)",
        backgroundColor: state !== "unchecked" ? "var(--color-brand-600)" : "transparent",
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
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0 || node.courses.length > 0;
    const checkState = getNodeCheckState(node, selectedCourseIds);
    const totalCourses = collectCourseIds(node).length;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          {/* Expand/collapse */}
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
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
          <svg className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
            {node.name}
          </span>
          {totalCourses > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
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
                className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                style={{ paddingLeft: `${(depth + 1) * 20 + 4}px` }}
              >
                <span className="w-4" /> {/* spacer for alignment with expand button */}
                {renderCheckbox(
                  selectedCourseIds.has(course.id) ? "checked" : "unchecked",
                  () => toggleCourse(course.id),
                )}
                <GraduationCapIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
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
      <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
        No course nodes configured. Add nodes in the admin panel first.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#18181f] p-1">
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  );
}
