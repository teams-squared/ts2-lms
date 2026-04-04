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
    const response: Response = await client
      .api(`/drives/${DRIVE_ID}/root:/${DOCS_ROOT}/_categories.json:/content`)
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
    const result = await client
      .api(`/drives/${DRIVE_ID}/root:/${DOCS_ROOT}/${categorySlug}:/children`)
      .select("name")
      .get();

    const items: { name: string }[] = result.value ?? [];
    return items
      .filter((item) => item.name.endsWith(".mdx"))
      .map((item) => item.name);
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
      .api(`/drives/${DRIVE_ID}/root:/${DOCS_ROOT}/${categorySlug}/${fileName}:/content`)
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
