import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/types";

const VALID_PERIODS = ["1d", "7d", "30d", "90d"] as const;
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

  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  const id = params.get("id");
  const rawPeriod = params.get("period") ?? "30d";
  const period: Period = (VALID_PERIODS as readonly string[]).includes(rawPeriod)
    ? (rawPeriod as Period)
    : "30d";
  const days = periodToDays(period);

  if ((type !== "user" && type !== "doc") || !id) {
    return NextResponse.json(
      { error: "Invalid parameters: type must be 'user' or 'doc', id is required" },
      { status: 400 }
    );
  }

  // Escape single quotes in id to prevent HogQL injection
  const safeId = id.replace(/'/g, "\\'");

  let hogql: string;
  if (type === "user") {
    hogql = `
      SELECT
        timestamp,
        properties.doc_title      AS title,
        properties.category_title AS category_title
      FROM events
      WHERE event = 'document_viewed'
        AND distinct_id = '${safeId}'
        AND timestamp > now() - INTERVAL ${days} DAY
      ORDER BY timestamp DESC
      LIMIT 200
    `;
  } else {
    hogql = `
      SELECT
        timestamp,
        distinct_id             AS email,
        person.properties.name  AS name
      FROM events
      WHERE event = 'document_viewed'
        AND properties.doc_title = '${safeId}'
        AND timestamp > now() - INTERVAL ${days} DAY
      ORDER BY timestamp DESC
      LIMIT 200
    `;
  }

  try {
    const rows = await queryPostHog(apiKey, projectId, hogql);

    if (type === "user") {
      const events = rows.map(([timestamp, title, category_title]) => ({
        timestamp,
        title,
        category_title,
      }));
      return NextResponse.json({ configured: true, events });
    } else {
      const events = rows.map(([timestamp, email, name]) => ({
        timestamp,
        email,
        name,
      }));
      return NextResponse.json({ configured: true, events });
    }
  } catch (err) {
    console.error("[analytics/events] PostHog query failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch event data" },
      { status: 502 }
    );
  }
}
