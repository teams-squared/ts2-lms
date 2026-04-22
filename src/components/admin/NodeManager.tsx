"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  GraduationCapIcon,
} from "@/components/icons";
import type { NodeWithChildren } from "@/lib/courseNodes";

interface NodeManagerProps {
  initialTree: NodeWithChildren[];
}

export function NodeManager({ initialTree }: NodeManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [tree, setTree] = useState<NodeWithChildren[]>(initialTree);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingParentId, setAddingParentId] = useState<string | null | "root">(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    courseCount: number;
    childCount: number;
  } | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refreshTree = async () => {
    const res = await fetch("/api/admin/nodes");
    if (res.ok) {
      const data = (await res.json()) as NodeWithChildren[];
      setTree(data);
    }
  };

  const handleCreate = async (parentId: string | null) => {
    if (!newNodeName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNodeName.trim(), parentId }),
      });
      if (res.ok) {
        toast("Node created");
        setNewNodeName("");
        setAddingParentId(null);
        if (parentId) setExpanded((p) => new Set(p).add(parentId));
        await refreshTree();
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast(data.error ?? "Failed to create node");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/nodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        toast("Node renamed");
        setEditingId(null);
        await refreshTree();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/nodes/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Node deleted");
        await refreshTree();
        router.refresh();
      }
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  };

  const countCourses = (node: NodeWithChildren): number => {
    let count = node.courses.length;
    for (const child of node.children) count += countCourses(child);
    return count;
  };

  const renderNode = (node: NodeWithChildren, depth: number) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0 || node.courses.length > 0;
    const totalCourses = countCourses(node);

    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-surface-muted transition-colors"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => toggle(node.id)}
            className="w-5 h-5 flex items-center justify-center text-foreground-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronRightIcon className="w-3.5 h-3.5" />
              )
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Folder icon */}
          <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>

          {/* Name (editable) */}
          {editingId === node.id ? (
            <form
              onSubmit={(e) => { e.preventDefault(); void handleRename(node.id); }}
              className="flex items-center gap-1.5 flex-1"
            >
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => setEditingId(null)}
                className="text-sm px-1.5 py-0.5 rounded border border-primary/30 bg-surface text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </form>
          ) : (
            <button
              onClick={() => { setEditingId(node.id); setEditName(node.name); }}
              className="text-sm font-medium text-foreground hover:text-primary truncate text-left"
              title="Click to rename"
            >
              {node.name}
            </button>
          )}

          {/* Course count badge */}
          {totalCourses > 0 && (
            <span className="text-xs text-foreground-subtle tabular-nums ml-1">
              {totalCourses} course{totalCourses !== 1 ? "s" : ""}
            </span>
          )}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setAddingParentId(node.id); setNewNodeName(""); setExpanded((p) => new Set(p).add(node.id)); }}
              className="text-xs text-primary hover:underline px-1.5 py-0.5"
              title="Add child node"
            >
              + Child
            </button>
            <button
              onClick={() =>
                setPendingDelete({
                  id: node.id,
                  name: node.name,
                  courseCount: totalCourses,
                  childCount: node.children.length,
                })
              }
              className="text-xs text-danger hover:text-danger px-1.5 py-0.5"
              title="Delete node"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Add child form */}
        {addingParentId === node.id && (
          <div
            className="flex items-center gap-2 py-1.5 px-2"
            style={{ paddingLeft: `${(depth + 1) * 24 + 8}px` }}
          >
            <input
              autoFocus
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setAddingParentId(null); if (e.key === "Enter") void handleCreate(node.id); }}
              placeholder="New node name…"
              className="text-sm px-2 py-1 rounded-lg border border-border bg-surface text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-48"
            />
            <button
              onClick={() => void handleCreate(node.id)}
              disabled={loading || !newNodeName.trim()}
              className="text-xs text-primary-foreground bg-primary hover:bg-primary-hover disabled:opacity-50 px-2.5 py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Add
            </button>
            <button
              onClick={() => setAddingParentId(null)}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Children */}
        {isExpanded && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {/* Show courses at this level */}
            {node.courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-1.5 py-1.5 px-2 text-sm text-foreground-muted"
                style={{ paddingLeft: `${(depth + 1) * 24 + 8}px` }}
              >
                <GraduationCapIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
                <span className="truncate">{course.title}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
                  course.status === "PUBLISHED"
                    ? "text-success bg-success-subtle"
                    : course.status === "DRAFT"
                      ? "text-warning bg-warning-subtle"
                      : "text-foreground-muted bg-surface-muted dark:text-foreground-subtle dark:bg-surface-muted"
                }`}>
                  {course.status.toLowerCase()}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Add root node */}
      <div className="flex items-center gap-2">
        {addingParentId === "root" ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setAddingParentId(null); if (e.key === "Enter") void handleCreate(null); }}
              placeholder="Root node name…"
              className="text-sm px-2 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
            />
            <button
              onClick={() => void handleCreate(null)}
              disabled={loading || !newNodeName.trim()}
              className="text-xs text-primary-foreground bg-primary hover:bg-primary-hover disabled:opacity-50 px-3 py-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Add
            </button>
            <button
              onClick={() => setAddingParentId(null)}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setAddingParentId("root"); setNewNodeName(""); }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary-subtle transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add root node
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-2">
        {tree.length === 0 ? (
          <p className="text-sm text-foreground-subtle text-center py-8">
            No nodes yet. Create one to start organizing courses.
          </p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete node?"
        description={
          pendingDelete ? (
            <>
              Delete{" "}
              <span className="font-medium text-foreground">
                &ldquo;{pendingDelete.name}&rdquo;
              </span>
              ?{" "}
              {pendingDelete.childCount > 0 &&
                `${pendingDelete.childCount} child node${pendingDelete.childCount !== 1 ? "s" : ""} will be reparented. `}
              {pendingDelete.courseCount > 0 &&
                `${pendingDelete.courseCount} course${pendingDelete.courseCount !== 1 ? "s" : ""} will be unassigned from this branch.`}
            </>
          ) : null
        }
        confirmLabel="Delete node"
        onConfirm={handleDelete}
        loading={loading}
      />
    </div>
  );
}
