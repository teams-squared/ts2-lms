"use client";

import { useEffect, useState } from "react";

type Period = "7d" | "30d" | "90d";
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

const PERIODS: { value: Period; label: string }[] = [
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
              onClick={() => setTab(key)}
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

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load analytics: {error}
        </div>
      )}

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
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              ) : (data?.byPage ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No document views recorded in this period.
                  </td>
                </tr>
              ) : (
                (data?.byPage ?? []).map((row, i) => (
                  <tr key={i}>
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
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              ) : (data?.byUser ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No user activity recorded in this period.
                  </td>
                </tr>
              ) : (
                (data?.byUser ?? []).map((row, i) => (
                  <tr key={i}>
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
    </div>
  );
}
