"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailListInputProps {
  label: string;
  helper: string;
  value: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}

/** Reusable add/remove email-pill input. Used by both the ISO ack
 *  recipients form and the invite-email CC form. */
export function EmailListInput({
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
