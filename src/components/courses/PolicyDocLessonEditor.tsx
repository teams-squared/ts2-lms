"use client";

/**
 * Inline editor for POLICY_DOC lesson bodies (rendered inside ModuleManager's
 * edit dialog when editType === "policy_doc").
 *
 * Three states:
 *   1. Unbound — no PolicyDocLesson row yet. Show "Choose SharePoint document"
 *      → opens SharePointFilePicker (filtered to .docx) → POSTs sync route.
 *   2. Bound + synced — show snapshot metadata (title, code, version,
 *      approver, last synced) + "Re-sync" + "Replace document" buttons.
 *   3. Loading / syncing — pending UI.
 *
 * Sync side-effects (version invalidation, audit) are handled server-side in
 * /api/admin/policy-doc/sync. This component is a thin call site.
 */

import { useEffect, useState, useCallback } from "react";
import { SharePointFilePicker } from "./SharePointFilePicker";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface PolicyDocSnapshot {
  id: string;
  sharePointDriveId: string;
  sharePointItemId: string;
  sharePointWebUrl: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  sourceETag: string;
  sourceLastModified: string;
  approver: string | null;
  approvedOn: string | null;
  lastReviewedOn: string | null;
  renderMode: "PARSED" | "EMBED";
  renderedHTMLHash: string;
  lastSyncedAt: string;
  lastSyncedBy: { name: string | null; email: string } | null;
}

interface SyncedResponse {
  status: "synced" | "noop";
  versionChanged?: boolean;
  invalidatedAcknowledgements?: number;
  warnings?: string[];
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function PolicyDocLessonEditor({ lessonId }: { lessonId: string }) {
  const [snapshot, setSnapshot] = useState<PolicyDocSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [resolving, setResolving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/policy-doc/${lessonId}`);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { bound: boolean; policyDoc?: PolicyDocSnapshot };
      setSnapshot(data.bound && data.policyDoc ? data.policyDoc : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policy doc state");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSync = useCallback(
    async (driveId: string, itemId: string) => {
      setSyncing(true);
      setError(null);
      setLastSyncMessage(null);
      try {
        const res = await fetch("/api/admin/policy-doc/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, driveId, itemId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Sync failed (${res.status})`);
        }
        const data = (await res.json()) as SyncedResponse;
        if (data.status === "noop") {
          setLastSyncMessage("Already up to date — SharePoint hasn't changed since last sync.");
        } else if (data.versionChanged) {
          const n = data.invalidatedAcknowledgements ?? 0;
          setLastSyncMessage(
            `Synced. Version changed — ${n} learner acknowledgement${n === 1 ? "" : "s"} cleared; affected users will need to re-acknowledge.`,
          );
        } else {
          setLastSyncMessage("Synced.");
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        setSyncing(false);
      }
    },
    [lessonId, refresh],
  );

  const handlePickerSelect = useCallback(
    (ref: SharePointDocumentRef) => {
      setPickerOpen(false);
      void runSync(ref.driveId, ref.itemId);
    },
    [runSync],
  );

  const handleResolveLink = useCallback(async () => {
    const url = shareUrl.trim();
    if (!url) return;
    setResolving(true);
    setError(null);
    setLastSyncMessage(null);
    try {
      const res = await fetch("/api/admin/policy-doc/resolve-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareUrl: url }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        driveId?: string;
        itemId?: string;
        error?: string;
      };
      if (!res.ok || !data.driveId || !data.itemId) {
        throw new Error(data.error ?? `Could not resolve link (${res.status})`);
      }
      setShareUrl("");
      await runSync(data.driveId, data.itemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve link");
    } finally {
      setResolving(false);
    }
  }, [shareUrl, runSync]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-foreground-muted">
        Policy document (Word .docx in SharePoint)
      </label>

      {snapshot ? (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {snapshot.documentTitle}
              </p>
              <p className="text-xs text-foreground-muted">
                {snapshot.documentCode ? `${snapshot.documentCode} · ` : ""}
                v{snapshot.sourceVersion}
                {snapshot.approver ? ` · approved by ${snapshot.approver}` : ""}
              </p>
              <p className="text-xs text-foreground-subtle mt-1">
                Last synced {formatRel(snapshot.lastSyncedAt)}
                {snapshot.lastSyncedBy?.name ? ` by ${snapshot.lastSyncedBy.name}` : ""}
              </p>
            </div>
            <a
              href={snapshot.sharePointWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Open in SharePoint ↗
            </a>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void runSync(snapshot.sharePointDriveId, snapshot.sharePointItemId)}
              disabled={syncing}
              className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Re-sync"}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={syncing}
              className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted disabled:opacity-50"
            >
              Replace document…
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
            <label className="block text-xs font-medium text-foreground-muted">
              Paste SharePoint link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                placeholder="https://teamssquared.sharepoint.com/…/POL-002.docx"
                disabled={syncing || resolving}
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleResolveLink();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleResolveLink()}
                disabled={!shareUrl.trim() || syncing || resolving}
                className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {resolving ? "Resolving…" : syncing ? "Syncing…" : "Use link"}
              </button>
            </div>
            <p className="text-xs text-foreground-subtle">
              Works for any .docx in the tenant — copy a link from SharePoint&rsquo;s
              &ldquo;Copy link&rdquo; button or paste the file&rsquo;s URL from the address bar.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-foreground-subtle">
            <span className="flex-1 border-t border-border" />
            <span>or</span>
            <span className="flex-1 border-t border-border" />
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={syncing || resolving}
            className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-primary w-full text-center hover:bg-primary-subtle transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Browse LMS Materials folder…"}
          </button>
        </div>
      )}

      {lastSyncMessage && (
        <p className="text-xs text-foreground-muted">{lastSyncMessage}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <SharePointFilePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        mimeTypeFilter={(m) => m === DOCX_MIME}
        filterLabel="Word documents (.docx)"
      />
    </div>
  );
}

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}
