"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LessonContentEditor, type LessonContentType } from "@/components/courses/LessonContentEditor";
import {
  ClearanceRequirementEditor,
  type ClearanceRequirementRow,
} from "@/components/courses/ClearanceRequirementEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const TYPE_OPTIONS: { value: LessonContentType; label: string }[] = [
  { value: "text", label: "Text (Markdown)" },
  { value: "document", label: "Document (SharePoint file)" },
  { value: "html", label: "HTML (embedded page)" },
  { value: "video", label: "Video (SharePoint or URL)" },
  { value: "link", label: "Link (external article)" },
];

interface InternalDocEditorProps {
  /** Present in edit mode; absent when creating. */
  docId?: string;
  initialTitle?: string;
  initialType?: LessonContentType;
  initialContent?: string;
  initialCategory?: string;
  initialRequirements?: ClearanceRequirementRow[];
  /** Sectors the author may require (their own clearance sectors; all for admin). */
  sectors: { id: string; label: string }[];
  /** Per-sector minimum tier the author may set. Omitted for admins. */
  minTierBySector?: Record<string, number>;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function InternalDocEditor({
  docId,
  initialTitle = "",
  initialType = "text",
  initialContent = "",
  initialCategory = "",
  initialRequirements = [],
  sectors,
  minTierBySector,
}: InternalDocEditorProps) {
  const router = useRouter();
  const isEdit = Boolean(docId);

  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<LessonContentType>(initialType);
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState(initialCategory);
  const [requirements, setRequirements] = useState<ClearanceRequirementRow[]>(initialRequirements);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Requirements are collected locally and sent on save (both create + edit).
  const addRequirement = (sectorId: string, tier: number) => {
    const sectorLabel = sectors.find((s) => s.id === sectorId)?.label ?? sectorId;
    setRequirements((prev) => [...prev.filter((r) => r.sectorId !== sectorId), { sectorId, sectorLabel, tier }]);
  };
  const removeRequirement = (sectorId: string) => {
    setRequirements((prev) => prev.filter((r) => r.sectorId !== sectorId));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (requirements.length === 0) {
      setError("Add at least one clearance requirement. Internal docs can't be unrestricted.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        type,
        content: content || null,
        category: category.trim() || null,
        requirements: requirements.map((r) => ({ sectorId: r.sectorId, tier: r.tier })),
      };
      if (isEdit) {
        await apiFetch(`/api/internal-docs/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        router.push(`/internal-docs/${docId}`);
      } else {
        const created = await apiFetch<{ id: string }>("/api/internal-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        router.push(`/internal-docs/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!docId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/internal-docs/${docId}`, { method: "DELETE" });
      router.push("/internal-docs");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
      setPendingDelete(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Document</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="doc-title" className="block text-xs font-medium text-foreground-muted mb-1">
              Title <span className="text-danger">*</span>
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="doc-type" className="block text-xs font-medium text-foreground-muted mb-1">
                Type
              </label>
              <select
                id="doc-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as LessonContentType);
                  setContent("");
                }}
                className="rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="doc-category" className="block text-xs font-medium text-foreground-muted mb-1">
                Category / folder <span className="text-foreground-muted">(optional)</span>
              </label>
              <input
                id="doc-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Runbooks"
                className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-foreground-muted mb-1">Content</span>
            <LessonContentEditor type={type} content={content} onChange={setContent} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Clearance requirements</h2>
        <ClearanceRequirementEditor
          requirements={requirements}
          sectors={sectors}
          onAdd={addRequirement}
          onRemove={removeRequirement}
          minTierBySector={minTierBySector}
          note="At least one requirement is mandatory — a viewer needs to satisfy ANY one of them. You can only require clearances within your own grants. Lower tier = more protected (0 = most restricted)."
        />
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create document"}
        </button>
        {isEdit && (
          <button
            onClick={() => setPendingDelete(true)}
            disabled={deleting}
            className="rounded-lg border border-danger/40 text-sm text-danger px-4 py-2 hover:bg-danger/10 disabled:opacity-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(false)}
        title="Delete document?"
        description="This permanently removes the internal document. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
