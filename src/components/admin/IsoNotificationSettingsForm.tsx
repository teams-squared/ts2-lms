"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

interface EmailListInputProps {
  label: string;
  helper: string;
  value: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}

function EmailListInput({
  label,
  helper,
  value,
  onChange,
  emptyHint,
}: EmailListInputProps) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const tryAdd = () => {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setLocalError(`"${trimmed}" is not a valid email`);
      return;
    }
    if (value.includes(trimmed)) {
      setLocalError("Already added");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
    setLocalError(null);
  };

  const remove = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      <p className="text-xs text-foreground-muted mb-2">{helper}</p>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted ring-1 ring-border text-sm text-foreground"
            >
              {email}
              <button
                type="button"
                onClick={() => remove(email)}
                aria-label={`Remove ${email}`}
                className="text-foreground-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        emptyHint && (
          <p className="text-xs text-foreground-subtle italic mb-2">
            {emptyHint}
          </p>
        )
      )}

      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (localError) setLocalError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              tryAdd();
            }
          }}
          placeholder="name@teamsquared.io"
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
        />
        <Button type="button" variant="secondary" onClick={tryAdd}>
          Add
        </Button>
      </div>
      {localError && (
        <p className="mt-1.5 text-xs text-danger">{localError}</p>
      )}
    </div>
  );
}
