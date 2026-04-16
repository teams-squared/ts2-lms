"use client";

import { useState } from "react";
import type { CourseStatus } from "@/lib/types";

export interface NodeOption {
  id: string;
  name: string;
  depth: number;
}

interface CourseFormProps {
  initialData?: {
    title: string;
    description: string | null;
    thumbnail: string | null;
    status: CourseStatus;
    nodeId?: string | null;
  };
  nodeOptions?: NodeOption[];
  onSubmit: (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
    nodeId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function CourseForm({
  initialData,
  nodeOptions,
  onSubmit,
  onCancel,
  submitLabel = "Create Course",
}: CourseFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [thumbnail, setThumbnail] = useState(initialData?.thumbnail || "");
  const [status, setStatus] = useState<CourseStatus>(
    initialData?.status || "draft"
  );
  const [nodeId, setNodeId] = useState(initialData?.nodeId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit({ title, description, thumbnail, status, nodeId: nodeId || null });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="course-title"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
        >
          Title *
        </label>
        <input
          id="course-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          placeholder="Introduction to Cybersecurity"
        />
      </div>

      <div>
        <label
          htmlFor="course-description"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
        >
          Description
        </label>
        <textarea
          id="course-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
          placeholder="A comprehensive introduction to..."
        />
      </div>

      <div>
        <label
          htmlFor="course-thumbnail"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
        >
          Thumbnail URL
        </label>
        <input
          id="course-thumbnail"
          type="url"
          value={thumbnail}
          onChange={(e) => setThumbnail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div>
        <label
          htmlFor="course-status"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
        >
          Status
        </label>
        <select
          id="course-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {nodeOptions && nodeOptions.length > 0 && (
        <div>
          <label
            htmlFor="course-node"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
          >
            Node
          </label>
          <select
            id="course-node"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">No node</option>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {"—".repeat(n.depth)}{n.depth > 0 ? " " : ""}{n.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
