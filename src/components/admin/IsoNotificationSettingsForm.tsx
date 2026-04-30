"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { EmailListInput } from "@/components/admin/EmailListInput";

interface Props {
  initialTo: string[];
  initialCc: string[];
  updatedAt: Date | null;
}

export function IsoNotificationSettingsForm({
  initialTo,
  initialCc,
  updatedAt: initialUpdatedAt,
}: Props) {
  const { toast } = useToast();
  const [toEmails, setToEmails] = useState<string[]>(initialTo);
  const [ccEmails, setCcEmails] = useState<string[]>(initialCc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/iso-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmails, ccEmails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Save failed (${res.status})`,
        );
      }
      const data = await res.json();
      setToEmails(data.toEmails);
      setCcEmails(data.ccEmails);
      setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : null);
      toast("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <EmailListInput
        label="To"
        helper="Primary recipients (e.g. ISO Officer, ISO Owner)."
        value={toEmails}
        onChange={setToEmails}
        emptyHint="No recipients — feature disabled."
      />
      <EmailListInput
        label="Cc"
        helper="Optional copy recipients."
        value={ccEmails}
        onChange={setCcEmails}
      />

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {updatedAt && (
          <span className="text-xs text-foreground-muted">
            Last updated {updatedAt.toLocaleString()}
          </span>
        )}
      </div>
    </form>
  );
}
