import { getGraphClient } from "./graph-client";
import type { Category } from "./types";

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID!;
const DOCS_ROOT = process.env.SHAREPOINT_DOCS_ROOT || "Docs for Portal";

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
    // GET /drives/{id}/root:/{DOCS_ROOT}/_categories.json:/content
    const response: Response = await client
      .api(`/drives/${DRIVE_ID}/root:/${DOCS_ROOT}/_categories.json:/content`)
      .responseType("raw" as never)
      .get();
    const text = await response.text();
    return JSON.parse(text) as Category[];
  });
}

/**
 * List all .mdx files in a category folder.
 * Returns file name and a pre-authenticated download URL (valid ~1 hour).
 * TTL: 5 minutes (well under the 1-hour download URL expiry).
 */
export async function fetchDocListFromSharePoint(
  categorySlug: string
): Promise<{ name: string; downloadUrl: string }[]> {
  return withCache(`doclist:${categorySlug}`, 5 * 60 * 1000, async () => {
    const client = getGraphClient();
    // GET /drives/{id}/root:/{DOCS_ROOT}/{category}:/children
    const result = await client
      .api(`/drives/${DRIVE_ID}/root:/${DOCS_ROOT}/${categorySlug}:/children`)
      .select("name,@microsoft.graph.downloadUrl")
      .get();

    const items: { name: string; "@microsoft.graph.downloadUrl"?: string }[] =
      result.value ?? [];

    return items
      .filter((item) => item.name.endsWith(".mdx"))
      .map((item) => ({
        name: item.name,
        downloadUrl: item["@microsoft.graph.downloadUrl"] ?? "",
      }));
  });
}

/**
 * Download the raw MDX content of a file using its pre-signed download URL.
 * TTL: 2 minutes.
 */
export async function fetchDocContentFromSharePoint(
  downloadUrl: string
): Promise<string> {
  // Use the URL as cache key (unique per file version)
  return withCache(`content:${downloadUrl}`, 2 * 60 * 1000, async () => {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch doc content: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  });
}
