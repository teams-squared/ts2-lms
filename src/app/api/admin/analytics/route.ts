import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/types";

const VALID_PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof VALID_PERIODS)[number];

function periodToDays(p: Period): number {
  return parseInt(p, 10);
}

async function queryPostHog(
  apiKey: string,
  projectId: string,
  query: string
): Promise<unknown[][]> {
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com";
  const res = await fetch(`${host}/api/projects/${projectId}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    // Don't cache — analytics data should always be fresh
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.results ?? []) as unknown[][];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userRole = ((session.user as { role?: Role }).role) ?? "employee";
  if (userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) {
    return NextResponse.json({ configured: false });
  }

  const raw = req.nextUrl.searchParams.get("period") ?? "30d";
  const period: Period = (VALID_PERIODS as readonly string[]).includes(raw)
    ? (raw as Period)
    : "30d";
  const days = periodToDays(period);

  const byPageQuery = `
    SELECT
      properties.doc_title AS title,
      properties.category AS category,
      properties.category_title AS category_title,
      count() AS views,
      count(distinct distinct_id) AS unique_users,
      max(timestamp) AS last_viewed
    FROM events
    WHERE event = 'document_viewed'
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY title, category, category_title
    ORDER BY views DESC
  `;

  const byUserQuery = `
    SELECT
      distinct_id AS email,
      person.properties.name AS name,
      count(distinct properties.doc_slug) AS unique_docs,
      count() AS total_views,
      max(timestamp) AS last_active
    FROM events
    WHERE event = 'document_viewed'
      AND timestamp > now() - INTERVAL ${days} DAY
      AND person.properties.name IS NOT NULL
    GROUP BY email, name
    ORDER BY last_active DESC
  `;

  try {
    const [byPageResults, byUserResults] = await Promise.all([
      queryPostHog(apiKey, projectId, byPageQuery),
      queryPostHog(apiKey, projectId, byUserQuery),
    ]);

    const byPage = byPageResults.map(
      ([title, category, category_title, views, unique_users, last_viewed]) => ({
        title,
        category,
        category_title,
        views,
        unique_users,
        last_viewed,
      })
    );

    const byUser = byUserResults.map(
      ([email, name, unique_docs, total_views, last_active]) => ({
        email,
        name,
        unique_docs,
        total_views,
        last_active,
      })
    );

    return NextResponse.json({ configured: true, byPage, byUser });
  } catch (err) {
    console.error("[analytics] PostHog query failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 502 }
    );
  }
}
