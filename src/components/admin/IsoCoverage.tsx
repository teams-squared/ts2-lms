"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface OutstandingUser {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  enrolledAt: string;
  lastSeenAckVersion: string | null;
  lastSeenAckAt: string | null;
}

interface PolicyRow {
  lessonId: string;
  courseId: string;
  courseTitle: string;
  documentTitle: string;
  documentCode: string | null;
  currentVersion: string;
  currentETag: string;
  enrolledCount: number;
  ackedCount: number;
  outstandingCount: number;
  outstanding: OutstandingUser[];
}

interface CoverageResponse {
  policies: PolicyRow[];
}

/**
 * Per-policy coverage view for ISO 27001 auditors. Shows for each
 * POLICY_DOC lesson: how many enrolled users are required to ack it,
 * how many have ack'd the *current* published version, and a drill-down
 * list of who is outstanding (with their most recent prior ack if any).
 *
 * Self-fetches from /api/admin/iso-coverage. The Download CSV button
 * hits /api/admin/iso-coverage/export which emits one row per
 * (outstanding user × policy).
 */
export function IsoCoverage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/iso-coverage");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed (${res.status})`,
        );
      }
      const payload = (await res.json()) as CoverageResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (lessonId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 rounded-lg border border-border bg-surface-muted">
        <p className="text-xs text-foreground-muted flex-1">
          Per-policy coverage of the current published version. Outstanding
          users are required to ack but haven&apos;t. Click a row to see who.
        </p>
        <a
          href="/api/admin/iso-coverage/export"
          download
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          Download CSV
        </a>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left">
            <tr className="text-xs uppercase tracking-wide text-foreground-muted">
              <th className="px-4 py-2 font-medium" />
              <th className="px-4 py-2 font-medium">Policy</th>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Version</th>
              <th className="px-4 py-2 font-medium">Required</th>
              <th className="px-4 py-2 font-medium">Ack&apos;d</th>
              <th className="px-4 py-2 font-medium">Outstanding</th>
              <th className="px-4 py-2 font-medium">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-foreground-muted"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data && data.policies.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-foreground-muted"
                >
                  No POLICY_DOC lessons configured yet.
                </td>
              </tr>
            )}
            {!loading &&
              data?.policies.map((row) => {
                const pct =
                  row.enrolledCount === 0
                    ? 100
                    : Math.round((row.ackedCount / row.enrolledCount) * 100);
                const isExpanded = expanded.has(row.lessonId);
                const colorClass =
                  pct >= 95
                    ? "text-success"
                    : pct >= 75
                      ? "text-info"
                      : pct >= 50
                        ? "text-warning"
                        : "text-danger";
                return (
                  <Fragment key={row.lessonId}>
                    <tr
                      className="border-t border-border cursor-pointer hover:bg-surface-muted/40"
                      onClick={() => toggle(row.lessonId)}
                    >
                      <td className="px-4 py-2 text-foreground-muted w-8">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        <div className="font-medium">{row.documentTitle}</div>
                        {row.documentCode && (
                          <div className="text-xs text-foreground-muted">
                            {row.documentCode}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        {row.courseTitle}
                      </td>
                      <td className="px-4 py-2 text-foreground tabular-nums">
                        v{row.currentVersion}
                      </td>
                      <td className="px-4 py-2 text-foreground tabular-nums">
                        {row.enrolledCount}
                      </td>
                      <td className="px-4 py-2 text-foreground tabular-nums">
                        {row.ackedCount}
                      </td>
                      <td className="px-4 py-2 text-foreground tabular-nums">
                        {row.outstandingCount}
                      </td>
                      <td className={`px-4 py-2 font-medium tabular-nums ${colorClass}`}>
                        {pct}%
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-border bg-surface-muted/30">
                        <td colSpan={8} className="px-4 py-3">
                          {row.outstanding.length === 0 ? (
                            <p className="text-xs text-foreground-muted">
                              All required users have ack&apos;d v
                              {row.currentVersion}.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="text-foreground-muted">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium">
                                      User
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Role
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Enrolled
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Last seen ack
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.outstanding.map((u) => (
                                    <tr
                                      key={u.userId}
                                      className="border-t border-border"
                                    >
                                      <td className="px-2 py-1 text-foreground">
                                        <div className="font-medium">
                                          {u.userName ?? u.userEmail}
                                        </div>
                                        {u.userName && (
                                          <div className="text-foreground-muted">
                                            {u.userEmail}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-foreground-muted">
                                        {u.userRole}
                                      </td>
                                      <td className="px-2 py-1 text-foreground-muted whitespace-nowrap">
                                        {new Date(u.enrolledAt).toLocaleDateString()}
                                      </td>
                                      <td className="px-2 py-1 text-foreground-muted whitespace-nowrap">
                                        {u.lastSeenAckVersion
                                          ? `v${u.lastSeenAckVersion} · ${
                                              u.lastSeenAckAt
                                                ? new Date(
                                                    u.lastSeenAckAt,
                                                  ).toLocaleDateString()
                                                : ""
                                            }`
                                          : "Never"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
