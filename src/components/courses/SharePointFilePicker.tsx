"use client";

import { useState, useEffect, useCallback } from "react";
import type { SharePointBrowseItem, SharePointBreadcrumb, SharePointDocumentRef } from "@/lib/sharepoint/types";

interface SharePointFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ref: SharePointDocumentRef) => void;
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📋";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📎";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SharePointFilePicker({ isOpen, onClose, onSelect }: SharePointFilePickerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<SharePointBrowseItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<SharePointBreadcrumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolder = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const res = await fetch(`/api/sharepoint/browse${query}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setItems(data.items);
      setBreadcrumbs(data.breadcrumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFolder(currentFolderId);
    }
  }, [isOpen, currentFolderId, fetchFolder]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentFolderId(undefined);
      setItems([]);
      setBreadcrumbs([]);
      setError(null);
    }
  }, [isOpen]);

  function handleFolderClick(folderId: string) {
    setCurrentFolderId(folderId);
  }

  function handleFileClick(item: SharePointBrowseItem) {
    if (item.type !== "file") return;
    onSelect({
      driveId: item.driveId,
      itemId: item.id,
      fileName: item.name,
      mimeType: item.mimeType,
    });
    onClose();
  }

  function handleBreadcrumbClick(id: string | null) {
    setCurrentFolderId(id ?? undefined);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1a1a24] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3a3a48] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3a3a48]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Browse SharePoint
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 px-6 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2a2a38]">
          <button
            onClick={() => handleBreadcrumbClick(null)}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Root
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => handleBreadcrumbClick(crumb.id)}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 text-sm text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              This folder is empty.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-[#2a2a38]">
              {items.map((item) => (
                <li key={item.id}>
                  {item.type === "folder" ? (
                    <button
                      onClick={() => handleFolderClick(item.id)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#22222e] rounded-lg px-2 transition-colors"
                    >
                      <span className="text-xl">📁</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.childCount} item{item.childCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-gray-400 text-sm">›</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFileClick(item)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg px-2 transition-colors"
                    >
                      <span className="text-xl">{fileIcon(item.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatSize(item.size)}
                        </p>
                      </div>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#3a3a48]">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click a file to attach it to this lesson.
          </p>
        </div>
      </div>
    </div>
  );
}
