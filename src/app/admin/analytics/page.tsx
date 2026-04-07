"use client";

import { useEffect, useState } from "react";

type Period = "1d" | "7d" | "30d" | "90d";
type Tab = "byPage" | "byUser";

interface PageRow {
  title: string;
  category: string;
  category_title: string;
  views: number;
  unique_users: number;
  last_viewed: string;
}

interface UserRow {
  email: string;
  name: string;
  unique_docs: number;
  total_views: number;
  last_active: string;
}

interface AnalyticsData {
  configured: boolean;
  byPage?: PageRow[];
  byUser?: UserRow[];
}

interface UserEvent {
  timestamp: string;
  title: string;
  category_title: string;
}

interface DocEvent {
  timestamp: string;
  email: string;
  name: string;
}

interface EventData {
  configured: boolean;
  events?: (UserEvent | DocEvent)[];
}

type Detail = { type: "user" | "doc"; id: string; label: string } | null;

const PERIODS: { value: Period; label: string }[] = [
  { value: "1d", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-gray-100 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200/60 bg-white shadow-card overflow-hidden">
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("byPage");
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<Detail>(null);
  const [detailData, setDetailData] = useState<EventData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch aggregate data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<AnalyticsData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, [period]);

  // Fetch detail data when a row is selected
  useEffect(() => {
    if (!detail) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    fetch(
      `/api/admin/analytics/events?type=${detail.type}&id=${encodeURIComponent(detail.id)}&period=${period}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<EventData>;
      })
      .then((d) => {
        setDetailData(d);
        setDetailLoading(false);
      })
      .catch((err: unknown) => {
        setDetailError(err instanceof Error ? err.message : "Unknown error");
        setDetailLoading(false);
      });
  }, [detail, period]);

  // ── Not configured ──────────────────────────────────────────────────────
  if (!loading && data && !data.configured) {
    return (
      <div className="rounded-lg border border-gray-200/60 bg-white shadow-card p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Connect PostHog API access
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Add two environment variables to enable the analytics dashboard.
        </p>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
              1
            </span>
            <span>
              In PostHog, go to <strong>Settings → Personal API keys</strong> and
              create a key with <em>read</em> access.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
              2
            </span>
            <span>
              Find your project ID in the PostHog URL:{" "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                app.posthog.com/project/<strong>12345</strong>/...
              </code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
              3
            </span>
            <span>
              Add to your{" "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                .env.local
              </code>{" "}
              (and your production environment):
              <code className="text-xs bg-gray-100 px-2 py-1.5 rounded block mt-1.5 leading-5">
                POSTHOG_API_KEY=phx_...
                <br />
                POSTHOG_PROJECT_ID=12345
              </code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
              4
            </span>
            <span>Restart the server — this dashboard will appear.</span>
          </li>
        </ol>
      </div>
    );
  }

  const tabLabel = tab === "byPage" ? "By Document" : "By User";

  // ── Dashboard ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        {/* Sub-tabs */}
        <div className="flex border-b border-gray-200 gap-1">
          {(
            [
              { key: "byPage" as Tab, label: "By Document" },
              { key: "byUser" as Tab, label: "By User" },
            ]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setDetail(null);
              }}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t ${
                tab === key
                  ? "border-brand-600 text-brand-700 bg-brand-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="text-sm border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {PERIODS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Aggregate error */}
      {error && !detail && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load analytics: {error}
        </div>
      )}

      {/* ── Detail view ──────────────────────────────────────────────────── */}
      {detail && (
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setDetail(null);
                setDetailData(null);
              }}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
            >
              ← {tabLabel}
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
              {detail.label}
            </span>
          </div>

          {/* Detail error */}
          {detailError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Failed to load events: {detailError}
            </div>
          )}

          <TableCard>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {detail.type === "user"
                    ? ["Timestamp", "Document", "Category"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))
                    : ["Timestamp", "Name", "Email"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detailLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols={3} />
                  ))
                ) : (detailData?.events ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      No events recorded for this period.
                    </td>
                  </tr>
                ) : detail.type === "user" ? (
                  (detailData?.events as UserEvent[]).map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 text-sm text-gray-400 whitespace-nowrap">
                        {formatDateTime(row.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                        {row.title ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {row.category_title ?? "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  (detailData?.events as DocEvent[]).map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 text-sm text-gray-400 whitespace-nowrap">
                        {formatDateTime(row.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                        {row.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {row.email ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
      )}

      {/* ── Aggregate tables (hidden when detail is open) ─────────────────── */}
      {!detail && (
        <>
          {/* By Document table */}
          {tab === "byPage" && (
            <TableCard>
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {["Document", "Category", "Views", "Unique Viewers", "Last Viewed"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} cols={5} />
                    ))
                  ) : (data?.byPage ?? []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-400"
                      >
                        No document views recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    (data?.byPage ?? []).map((row, i) => (
                      <tr
                        key={i}
                        onClick={() =>
                          setDetail({
                            type: "doc",
                            id: row.title,
                            label: row.title,
                          })
                        }
                        className="cursor-pointer hover:bg-brand-50/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                          {row.title ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">
                          {row.category_title ?? row.category ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 tabular-nums">
                          {row.views}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 tabular-nums">
                          {row.unique_users}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-400">
                          {formatDate(row.last_viewed)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableCard>
          )}

          {/* By User table */}
          {tab === "byUser" && (
            <TableCard>
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {["Name", "Email", "Docs Viewed", "Total Views", "Last Active"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} cols={5} />
                    ))
                  ) : (data?.byUser ?? []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-400"
                      >
                        No user activity recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    (data?.byUser ?? []).map((row, i) => (
                      <tr
                        key={i}
                        onClick={() =>
                          setDetail({
                            type: "user",
                            id: row.email,
                            label: `${row.name ?? row.email} (${row.email})`,
                          })
                        }
                        className="cursor-pointer hover:bg-brand-50/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                          {row.name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">
                          {row.email ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 tabular-nums">
                          {row.unique_docs}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 tabular-nums">
                          {row.total_views}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-400">
                          {formatDate(row.last_active)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableCard>
          )}
        </>
      )}
    </div>
  );
}
