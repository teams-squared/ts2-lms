"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FormButton } from "@/components/ui/FormButton";
import { useToast } from "@/components/ui/ToastProvider";

interface Candidate {
  id: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  lesson: {
    title: string;
    module: {
      title: string;
      course: { id: string; title: string };
    };
  };
}

interface Props {
  onClose: () => void;
  onAdded: () => void | Promise<void>;
}

/**
 * Modal picker — lists PolicyDocLessons not yet in the library so the
 * admin can multi-select and add them in one POST. No close-on-backdrop;
 * admins explicitly Cancel or Add to dismiss.
 */
export function IsoLibraryPicker({ onClose, onAdded }: Props) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/iso-library/available", { cache: "no-store" });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        if (!cancelled) setCandidates(data.candidates as Candidate[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/iso-library/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyDocLessonIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(`Add failed (${res.status})`);
      const data = await res.json();
      toast(
        `Added ${(data.createdIds as string[]).length} doc${(data.createdIds as string[]).length === 1 ? "" : "s"} to library`,
      );
      await onAdded();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((c) => {
        const hay = `${c.documentTitle} ${c.documentCode ?? ""} ${c.lesson.module.course.title} ${c.lesson.title}`.toLowerCase();
        return hay.includes(q);
      })
    : candidates;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iso-library-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 id="iso-library-picker-title" className="text-sm font-semibold text-foreground">
            Add docs to ISO Docs library
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="border-b border-border px-4 py-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title, code, course, lesson…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-foreground-muted">Loading…</p>
          ) : error ? (
            <div className="m-4 rounded-lg border border-danger/60 bg-danger-subtle px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-foreground-muted">
              {candidates.length === 0
                ? "Every policy-doc lesson is already in the library."
                : "No matches for that filter."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {c.documentTitle}
                        </p>
                        <p className="truncate text-xs text-foreground-muted">
                          {c.documentCode && (
                            <>
                              <span className="font-mono">{c.documentCode}</span>
                              {" · "}
                            </>
                          )}
                          v{c.sourceVersion}
                          {" · "}
                          {c.lesson.module.course.title} → {c.lesson.title}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-foreground-muted">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <FormButton
              type="button"
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              loading={saving}
            >
              Add {selected.size > 0 ? `(${selected.size})` : ""}
            </FormButton>
          </div>
        </footer>
      </div>
    </div>
  );
}
