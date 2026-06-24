"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_LIST_SCROLL,
  ADMIN_LIST_THEAD,
} from "@/components/admin/listScroll";
import { AUDIT_ACTIONS } from "@/lib/auditActions";

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  actor: { name: string | null; email: string } | null;
}

interface ListResponse {
  rows: AuditRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

type Preset = "30d" | "90d" | "all";

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(preset: Preset): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  const days = preset === "30d" ? 30 : 90;
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { from: toInputDate(from), to: toInputDate(today) };
}

/** Filter query shared by the list + export + manifest endpoints. `from` is
 *  inclusive at start-of-day; `to` inclusive at end-of-day. */
function filterQuery(opts: {
  from: string;
  to: string;
  action: string;
  actorId: string;
}): URLSearchParams {
  const qs = new URLSearchParams();
  if (opts.from) qs.set("from", `${opts.from}T00:00:00.000Z`);
  if (opts.to) qs.set("to", `${opts.to}T23:59:59.999Z`);
  if (opts.action) qs.set("action", opts.action);
  if (opts.actorId.trim()) qs.set("actorId", opts.actorId.trim());
  return qs;
}

export function AuditLogExplorer() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filterQuery({ from, to, action, actorId });
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String((page - 1) * PAGE_SIZE));
      const res = await fetch(`/api/admin/audit-logs?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed (${res.status})`,
        );
      }
      setData((await res.json()) as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, action, actorId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (preset: Preset) => {
    const r = presetRange(preset);
    setFrom(r.from);
    setTo(r.to);
    setPage(1);
  };

  const exportQs = filterQuery({ from, to, action, actorId }).toString();
  const csvHref = `/api/admin/audit-logs/export${exportQs ? `?${exportQs}` : ""}`;
  const manifestQs = new URLSearchParams(exportQs);
  manifestQs.set("format", "manifest");
  const manifestHref = `/api/admin/audit-logs/export?${manifestQs.toString()}`;

  const total = data?.total ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 rounded-lg border border-border bg-surface-muted">
        <div className="w-full sm:w-auto">
          <label
            htmlFor="audit-from"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="audit-to"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="audit-action"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            Action
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="audit-actor"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            Actor ID
          </label>
          <input
            id="audit-actor"
            type="text"
            placeholder="user id (optional)"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("30d")}
          >
            Last 30 days
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("90d")}
          >
            Last 90 days
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("all")}
          >
            All time
          </Button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <a
            href={csvHref}
            download
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            Download CSV
          </a>
          <a
            href={manifestHref}
            download="audit-logs-manifest.json"
            title="SHA-256 integrity manifest for the CSV above (same filters)"
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            Manifest
          </a>
        </div>
      </div>

      {/* Summary + pagination */}
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span>
          {loading
            ? "Loading…"
            : total === 0
              ? "No audit events in this range."
              : `Showing ${showingFrom}–${showingTo} of ${total}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Table — scrolls internally so the page itself stays put */}
      <div className={`${ADMIN_LIST_SCROLL} rounded-lg border border-border`}>
        <table className="w-full text-sm">
          <thead className={`${ADMIN_LIST_THEAD} bg-surface-muted text-left`}>
            <tr className="text-xs uppercase tracking-wide text-foreground-muted">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data && data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-foreground-muted"
                >
                  No audit events match these filters.
                </td>
              </tr>
            )}
            {data?.rows.map((row) => {
              const meta =
                row.metadata != null ? JSON.stringify(row.metadata) : "";
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-foreground font-mono text-xs">
                    {row.action}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {row.actorEmail ?? row.actor?.email ?? (
                      <span className="text-foreground-muted">system</span>
                    )}
                    {row.actor?.name && (
                      <div className="text-xs text-foreground-muted">
                        {row.actor.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-foreground-muted text-xs">
                    {row.targetType ?? "—"}
                    {row.targetId && (
                      <div className="font-mono max-w-[12rem] truncate">
                        {row.targetId}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-4 py-2 text-foreground-muted font-mono text-xs max-w-[22rem] truncate"
                    title={meta}
                  >
                    {meta || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
