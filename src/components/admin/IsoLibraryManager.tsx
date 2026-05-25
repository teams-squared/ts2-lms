"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FormButton } from "@/components/ui/FormButton";
import { useToast } from "@/components/ui/ToastProvider";
import { IsoLibraryPicker } from "@/components/admin/IsoLibraryPicker";

export interface LibraryEntry {
  id: string;
  policyDocLesson: {
    id: string;
    documentTitle: string;
    documentCode: string | null;
    sourceVersion: string;
    lastReviewedOn: string | null;
    lesson: {
      id: string;
      title: string;
      module: {
        id: string;
        title: string;
        course: { id: string; title: string };
      };
    };
  };
  addedBy: { id: string; name: string | null; email: string };
}

export function IsoLibraryManager() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/iso-library/entries", { cache: "no-store" });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setEntries(data.entries as LibraryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this doc from the library? The underlying course lesson is not affected.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/iso-library/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Remove failed (${res.status})`);
      toast("Removed from library");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Remove failed");
    }
  };

  const handleMove = async (id: string, direction: -1 | 1) => {
    const idx = entries.findIndex((e) => e.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= entries.length) return;

    // Local optimistic swap.
    const next = [...entries];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEntries(next);
    setPendingMove(true);

    try {
      const res = await fetch("/api/admin/iso-library/entries/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: next.map((e, i) => ({ id: e.id, sortOrder: i })),
        }),
      });
      if (!res.ok) throw new Error(`Reorder failed (${res.status})`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reorder failed");
      // Rebuild from server so we don't show a stale local order.
      await refresh();
    } finally {
      setPendingMove(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          {entries.length} doc{entries.length === 1 ? "" : "s"} in library
        </p>
        <FormButton onClick={() => setPickerOpen(true)} disabled={loading}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add docs
        </FormButton>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-foreground-muted">
          No docs in library yet. Click <span className="font-medium">Add docs</span> to pick from your existing policy-doc lessons.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {entries.map((entry, idx) => {
            const doc = entry.policyDocLesson;
            return (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(entry.id, -1)}
                    disabled={idx === 0 || pendingMove}
                    aria-label="Move up"
                    className="rounded-sm p-0.5 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(entry.id, 1)}
                    disabled={idx === entries.length - 1 || pendingMove}
                    aria-label="Move down"
                    className="rounded-sm p-0.5 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.documentTitle}
                  </p>
                  <p className="truncate text-xs text-foreground-muted">
                    {doc.documentCode && (
                      <>
                        <span className="font-mono">{doc.documentCode}</span>
                        {" · "}
                      </>
                    )}
                    v{doc.sourceVersion}
                    {" · "}
                    <span title={`${doc.lesson.module.course.title} → ${doc.lesson.module.title} → ${doc.lesson.title}`}>
                      {doc.lesson.module.course.title} → {doc.lesson.title}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  aria-label={`Remove ${doc.documentTitle} from library`}
                  className="rounded-md p-1.5 text-foreground-muted hover:bg-danger-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen && (
        <IsoLibraryPicker
          onClose={() => setPickerOpen(false)}
          onAdded={async () => {
            setPickerOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
