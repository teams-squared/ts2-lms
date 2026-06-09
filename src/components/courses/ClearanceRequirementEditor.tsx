"use client";

import { useState } from "react";

export interface ClearanceRequirementRow {
  sectorId: string;
  sectorLabel: string;
  tier: number;
}

interface ClearanceRequirementEditorProps {
  /** Current requirements on the resource (controlled by the parent). */
  requirements: ClearanceRequirementRow[];
  /** Sectors the user is allowed to add a requirement for. */
  sectors: { id: string; label: string }[];
  /** Add a requirement. Parent decides whether this hits an API or local state. */
  onAdd: (sectorId: string, tier: number) => Promise<void> | void;
  /** Remove the requirement for a sector. */
  onRemove: (sectorId: string) => Promise<void> | void;
  /**
   * Optional per-sector minimum tier the user may set. Used in author mode so a
   * user can only stamp requirements within their own clearance (their tier or
   * a less-protected, higher-numbered tier in that sector). Sectors absent from
   * the map are not constrained.
   */
  minTierBySector?: Record<string, number>;
  /** Optional helper text under the heading. */
  note?: string;
  busy?: boolean;
  /** Externally-surfaced error (e.g. API failure) shown above the form. */
  error?: string | null;
}

/**
 * Shared editor for a resource's sector+tier clearance requirements
 * (ANY-satisfies). Used by the course editor and the internal-doc editor.
 * Controlled: the parent owns the `requirements` array and wires add/remove.
 */
export function ClearanceRequirementEditor({
  requirements,
  sectors,
  onAdd,
  onRemove,
  minTierBySector,
  note,
  busy = false,
  error,
}: ClearanceRequirementEditorProps) {
  const [sectorId, setSectorId] = useState("");
  const [tier, setTier] = useState("0");
  const [localError, setLocalError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // A sector already carrying a requirement can't get a second one.
  const usedSectorIds = new Set(requirements.map((r) => r.sectorId));
  const selectableSectors = sectors.filter((s) => !usedSectorIds.has(s.id));

  const handleAdd = async () => {
    if (!sectorId) return;
    const t = Number(tier);
    if (!Number.isInteger(t) || t < 0) {
      setLocalError("Tier must be a non-negative integer (0 = most restricted)");
      return;
    }
    const min = minTierBySector?.[sectorId];
    if (min != null && t < min) {
      setLocalError(
        `You can only require tier ${min} or higher in this sector (your own clearance).`,
      );
      return;
    }
    setLocalError(null);
    setWorking(true);
    try {
      await onAdd(sectorId, t);
      setSectorId("");
      setTier("0");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to add requirement");
    } finally {
      setWorking(false);
    }
  };

  const disabled = busy || working;

  return (
    <div>
      <p className="text-xs text-foreground-muted mb-3">
        {note ??
          "A viewer needs to satisfy ANY one requirement. Lower tier = more protected (0 = most restricted); holding a tier also grants every higher-numbered tier in that sector."}
      </p>

      {(error || localError) && (
        <p className="mb-3 text-sm text-danger">{error ?? localError}</p>
      )}

      {selectableSectors.length === 0 && sectors.length === 0 ? (
        <p className="mb-3 text-sm text-foreground-subtle italic">
          No sectors available. Create sectors under{" "}
          <a href="/admin/clearance" className="text-primary hover:underline">
            Clearance
          </a>{" "}
          first.
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="req-sector" className="block text-xs font-medium text-foreground-muted mb-1">
              Sector
            </label>
            <select
              id="req-sector"
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              aria-label="Requirement sector"
              disabled={disabled || selectableSectors.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select a sector…</option>
              {selectableSectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {minTierBySector?.[s.id] != null ? ` (min tier ${minTierBySector[s.id]})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-24">
            <label htmlFor="req-tier" className="block text-xs font-medium text-foreground-muted mb-1">
              Tier
            </label>
            <input
              id="req-tier"
              type="number"
              min={0}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              aria-label="Requirement tier"
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={disabled || !sectorId}
            aria-label="Add clearance requirement"
            className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {working ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      {requirements.length === 0 ? (
        <p className="text-sm text-foreground-subtle italic">
          No clearance requirements. {note ? "" : "This resource is unrestricted."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {requirements.map((r) => (
            <span
              key={r.sectorId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-subtle text-primary border border-primary/20"
            >
              {r.sectorLabel} · tier {r.tier}
              <button
                type="button"
                onClick={() => void onRemove(r.sectorId)}
                disabled={disabled}
                aria-label={`Remove ${r.sectorLabel} requirement`}
                className="ml-0.5 text-primary/70 hover:text-danger disabled:opacity-50 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
