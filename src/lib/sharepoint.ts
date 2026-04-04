import { getGraphClient } from "./graph-client";
import type { Category } from "./types";

const DOCS_ROOT = encodeURIComponent(
  process.env.SHAREPOINT_DOCS_ROOT || "Docs for Portal"
);

// Prefer site-based path (more reliable for SharePoint).
// Falls back to drive ID if site ID is not set.
const SITE_ID = process.env.SHAREPOINT_SITE_ID;
const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;

if (!SITE_ID && !DRIVE_ID) {
  throw new Error(
    "Missing SharePoint configuration: set SHAREPOINT_SITE_ID (preferred) or SHAREPOINT_DRIVE_ID."
  );
}

const API_BASE = SITE_ID
  ? `/sites/${SITE_ID}/drive/root:`
  : `/drives/${DRIVE_ID}/root:`;

console.log("[sharepoint] API_BASE:", API_BASE, "| DOCS_ROOT:", DOCS_ROOT);

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  const value = await fn();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// ---------------------------------------------------------------------------
// SharePoint fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch and parse _categories.json from the root of the Docs for Portal folder.
 * TTL: 10 minutes.
 */
export async function fetchCategoriesFromSharePoint(): Promise<Category[]> {
  return withCache("categories", 10 * 60 * 1000, async () => {
    const client = getGraphClient();
    const path = `${API_BASE}/${DOCS_ROOT}/_categories.json:/content`;
    console.log("[sharepoint] fetching categories:", path);
    const response: Response = await client
      .api(path)
      .responseType("raw" as never)
      .get();
    const text = await response.text();
    return JSON.parse(text) as Category[];
  });
}

/**
 * List all .mdx file names in a category folder.
 * TTL: 5 minutes.
 */
export async function fetchDocListFromSharePoint(
  categorySlug: string
): Promise<string[]> {
  return withCache(`doclist:${categorySlug}`, 5 * 60 * 1000, async () => {
    const client = getGraphClient();
    try {
      const result = await client
        .api(`${API_BASE}/${DOCS_ROOT}/${categorySlug}:/children`)
        .select("name")
        .get();

      const items: { name: string }[] = result.value ?? [];
      return items
        .filter((item) => item.name.endsWith(".mdx"))
        .map((item) => item.name);
    } catch (e: unknown) {
      // Parent categories have no folder in SharePoint — return empty list
      if (
        typeof e === "object" &&
        e !== null &&
        "statusCode" in e &&
        (e as { statusCode: number }).statusCode === 404
      ) {
        return [];
      }
      throw e;
    }
  });
}

/**
 * Fetch the raw MDX content of a file directly via the Graph API /content endpoint.
 * Avoids reliance on pre-signed download URLs which aren't reliably returned for
 * SharePoint files.
 * TTL: 2 minutes.
 */
export async function fetchDocContentFromSharePoint(
  categorySlug: string,
  fileName: string
): Promise<string> {
  return withCache(`content:${categorySlug}/${fileName}`, 2 * 60 * 1000, async () => {
    const client = getGraphClient();
    const response: Response = await client
      .api(`${API_BASE}/${DOCS_ROOT}/${categorySlug}/${fileName}:/content`)
      .responseType("raw" as never)
      .get();
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${categorySlug}/${fileName}: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  });
}
