"use client";

import { useState } from "react";
import { FormButton } from "@/components/ui/FormButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

interface Props {
  initialPaused: boolean;
  initialReason: string;
  updatedAt: string | null;
}

/**
 * Legal-hold control for audit-log retention. While paused, the
 * prune-audit-logs cron skips deletion so evidence tied to an open
 * investigation / active ISO audit survives past the retention window.
 */
export function AuditRetentionControl({
  initialPaused,
  initialReason,
  updatedAt,
}: Props) {
  const { toast } = useToast();
  const [paused, setPaused] = useState(initialPaused);
  const [reason, setReason] = useState(initialReason);
  const [saving, setSaving] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(updatedAt);

  async function save(nextPaused: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/audit-retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prunePaused: nextPaused,
          pauseReason: nextPaused ? reason.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed (${res.status})`,
        );
      }
      const data = (await res.json()) as {
        prunePaused: boolean;
        pauseReason: string | null;
        updatedAt: string;
      };
      setPaused(data.prunePaused);
      setReason(data.pauseReason ?? "");
      setLastUpdated(data.updatedAt);
      toast(
        data.prunePaused
          ? "Legal hold active — pruning paused"
          : "Legal hold cleared — pruning resumed",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  // Turning the hold OFF re-enables deletion of out-of-window logs — confirm it.
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (initialPaused && !paused) {
      setConfirmResume(true);
      return;
    }
    void save(paused);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-border bg-surface p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Legal hold</h2>
          <p className="mt-0.5 text-xs text-foreground-muted">
            Pause automatic deletion of audit logs while an investigation or ISO
            audit is open. The retention cron skips entirely until cleared.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            paused
              ? "bg-warning-subtle text-warning border border-warning/50"
              : "bg-surface-muted text-foreground-muted border border-border"
          }`}
        >
          {paused ? "Hold active" : "Pruning normally"}
        </span>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={paused}
          onChange={(e) => setPaused(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">
            Pause audit-log pruning (legal hold)
          </span>
          <span className="block text-xs text-foreground-muted">
            When checked, no audit rows are deleted regardless of the retention
            window.
          </span>
        </span>
      </label>

      {paused && (
        <div>
          <label
            htmlFor="hold-reason"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            Reason (optional)
          </label>
          <input
            id="hold-reason"
            type="text"
            value={reason}
            maxLength={500}
            placeholder="e.g. ISO audit 2026-Q3, case #42"
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-subtle">
          {lastUpdated
            ? `Last changed ${new Date(lastUpdated).toLocaleString()}`
            : "Never changed"}
        </span>
        <FormButton type="submit" loading={saving} pendingLabel="Saving…">
          Save
        </FormButton>
      </div>

      <ConfirmDialog
        open={confirmResume}
        onOpenChange={setConfirmResume}
        title="Resume audit-log pruning?"
        description="Clearing the legal hold lets the retention cron delete audit logs older than the retention window again. Only do this once any investigation or audit relying on those logs is closed."
        confirmLabel="Resume pruning"
        destructive
        loading={saving}
        onConfirm={async () => {
          await save(false);
          setConfirmResume(false);
        }}
      />
    </form>
  );
}
