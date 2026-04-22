"use client";

import { useState, useEffect, useCallback } from "react";
import type { SharePointBrowseItem, SharePointBreadcrumb, SharePointDocumentRef } from "@/lib/sharepoint/types";

interface SharePointFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ref: SharePointDocumentRef) => void;
  mimeTypeFilter?: (mimeType: string) => boolean;
  /** Human-readable name of the filter for the header, e.g. "video files". */
  filterLabel?: string;
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("video/")) return "🎬";
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

export function SharePointFilePicker({ isOpen, onClose, onSelect, mimeTypeFilter, filterLabel }: SharePointFilePickerProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg border border-border flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              Browse SharePoint
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Navigate folders in your organisation&apos;s LMS library to find a file to attach to this lesson.
              {mimeTypeFilter && filterLabel ? (
                <>
                  {" "}
                  <span className="inline-flex items-center rounded-md bg-primary-subtle text-primary border border-primary/20 text-[10px] font-medium px-1.5 py-0.5 ml-1 align-middle">
                    Showing: {filterLabel} only
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-subtle hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 px-6 py-2 text-sm text-foreground-muted border-b border-border">
          <button
            onClick={() => handleBreadcrumbClick(null)}
            className="hover:text-primary dark:hover:text-primary transition-colors"
          >
            Root
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => handleBreadcrumbClick(crumb.id)}
                className="hover:text-primary dark:hover:text-primary transition-colors"
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
              <p className="text-sm text-foreground-muted">Loading…</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg bg-danger-subtle border border-danger/30 p-4 text-sm text-danger">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-foreground-muted py-8 text-center">
              This folder is empty.
            </p>
          )}

          {!loading && !error && items.length > 0 && (() => {
            const visible = mimeTypeFilter
              ? items.filter((i) => i.type === "folder" || mimeTypeFilter(i.mimeType))
              : items;
            if (visible.length === 0) {
              return (
                <p className="text-sm text-foreground-muted py-8 text-center">
                  No matching files in this folder.
                </p>
              );
            }
            return (
            <ul className="divide-y divide-border">
              {visible.map((item) => (
                <li key={item.id}>
                  {item.type === "folder" ? (
                    <button
                      onClick={() => handleFolderClick(item.id)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-muted rounded-lg px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-xl">📁</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {item.childCount} item{item.childCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-foreground-subtle text-sm">›</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFileClick(item)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-primary-subtle rounded-lg px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-xl">{fileIcon(item.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {formatSize(item.size)}
                        </p>
                      </div>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-foreground-muted">
            Click a file to attach it to this lesson.
          </p>
        </div>
      </div>
    </div>
  );
}
