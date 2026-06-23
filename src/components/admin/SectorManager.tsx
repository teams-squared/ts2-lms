"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Sector {
  id: string;
  key: string;
  label: string;
  description: string | null;
}

interface Props {
  initialSectors: Sector[];
}

export function SectorManager({ initialSectors }: Props) {
  const router = useRouter();
  const [sectors, setSectors] = useState<Sector[]>(initialSectors);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Add form state
  const [addLabel, setAddLabel] = useState("");
  const [addKey, setAddKey] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Sector | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clearMessages = () => {
    setError(null);
    setMessage(null);
  };

  const handleAdd = useCallback(async () => {
    const label = addLabel.trim();
    if (!label) return;

    setAdding(true);
    clearMessages();
    try {
      const res = await fetch("/api/admin/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          key: addKey.trim() || undefined,
          description: addDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const created = (await res.json()) as Sector;
      setSectors((prev) =>
        [...prev, created].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setAddLabel("");
      setAddKey("");
      setAddDescription("");
      setMessage("Sector added.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }, [addLabel, addKey, addDescription, router]);

  const startEdit = (sector: Sector) => {
    setEditingId(sector.id);
    setEditLabel(sector.label);
    setEditDescription(sector.description ?? "");
    clearMessages();
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = useCallback(
    async (id: string) => {
      const label = editLabel.trim();
      if (!label) return;

      setSavingId(id);
      clearMessages();

      const previous = sectors;
      // Optimistic update
      setSectors((prev) =>
        prev
          .map((s) =>
            s.id === id
              ? { ...s, label, description: editDescription.trim() || null }
              : s,
          )
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
      setEditingId(null);

      try {
        const res = await fetch(`/api/admin/sectors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            description: editDescription.trim() || null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setMessage("Sector updated.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        setSectors(previous);
      } finally {
        setSavingId(null);
      }
    },
    [editLabel, editDescription, sectors, router],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    clearMessages();

    try {
      const res = await fetch(`/api/admin/sectors/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setSectors((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMessage("Sector deleted.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, router]);

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
        <p className="text-xs font-medium text-foreground-muted">Add sector</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-foreground-muted" htmlFor="sector-label">
              Label <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="sector-label"
              type="text"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Cybersecurity"
              disabled={adding}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground-muted" htmlFor="sector-key">
              Key <span className="text-foreground-subtle">(optional — auto-derived)</span>
            </label>
            <input
              id="sector-key"
              type="text"
              value={addKey}
              onChange={(e) => setAddKey(e.target.value)}
              placeholder="e.g. cybersecurity"
              disabled={adding}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-foreground-muted" htmlFor="sector-description">
            Description <span className="text-foreground-subtle">(optional)</span>
          </label>
          <input
            id="sector-description"
            type="text"
            value={addDescription}
            onChange={(e) => setAddDescription(e.target.value)}
            placeholder="Short description of this sector"
            disabled={adding}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!addLabel.trim() || adding}
          className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add sector"}
        </button>
      </div>

      {message && <p className="text-xs text-foreground-muted">{message}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* List */}
      {sectors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-foreground-muted">
          No sectors yet. Add one above.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {sectors.map((sector) =>
            editingId === sector.id ? (
              <div key={sector.id} className="p-3 space-y-2 bg-surface-muted">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      className="text-xs text-foreground-muted"
                      htmlFor={`edit-label-${sector.id}`}
                    >
                      Label
                    </label>
                    <input
                      id={`edit-label-${sector.id}`}
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      disabled={savingId === sector.id}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-xs text-foreground-muted"
                      htmlFor={`edit-desc-${sector.id}`}
                    >
                      Description
                    </label>
                    <input
                      id={`edit-desc-${sector.id}`}
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={savingId === sector.id}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave(sector.id)}
                    disabled={!editLabel.trim() || savingId === sector.id}
                    className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                  >
                    {savingId === sector.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={savingId === sector.id}
                    className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={sector.id}
                className="flex items-start gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {sector.label}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    <code className="font-mono text-[11px] bg-surface-muted px-1 py-0.5 rounded">
                      {sector.key}
                    </code>
                    {sector.description && (
                      <span className="ml-2">{sector.description}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(sector)}
                    className="rounded-md border border-border text-xs text-foreground px-2.5 py-1 hover:bg-surface-muted"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setDeleteTarget(sector);
                    }}
                    className="rounded-md border border-border text-xs text-danger px-2.5 py-1 hover:bg-danger-subtle"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete sector?"
        description={
          deleteTarget ? (
            <span>
              Delete <strong>{deleteTarget.label}</strong>? Any users cleared for this sector will
              lose that clearance. This cannot be undone if the sector is not referenced by any
              course or document requirements — if it is, the delete will be blocked.
            </span>
          ) : null
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
