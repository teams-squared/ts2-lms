import { getGraphClient } from "./graph-client";
import type { Category } from "./types";
import {
  fetchCategoriesFromLocal,
  fetchDocListFromLocal,
  fetchDocContentFromLocal,
} from "./local-content";

const DOCS_ROOT = encodeURIComponent(
  process.env.SHAREPOINT_DOCS_ROOT || "Docs for Portal"
);

// Prefer site-based path (more reliable for SharePoint).
// Falls back to drive ID if site ID is not set.
const SITE_ID = process.env.SHAREPOINT_SITE_ID;
const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;

function getApiBase(): string {
  if (!SITE_ID && !DRIVE_ID) {
    throw new Error(
      "Missing SharePoint configuration: set SHAREPOINT_SITE_ID (preferred) or SHAREPOINT_DRIVE_ID."
    );
  }
  return SITE_ID
    ? `/sites/${SITE_ID}/drive/root:`
    : `/drives/${DRIVE_ID}/root:`;
}

function isSharePointConfigured(): boolean {
  return !!(
    (SITE_ID || DRIVE_ID) &&
    process.env.SHAREPOINT_TENANT_ID &&
    process.env.SHAREPOINT_CLIENT_ID &&
    process.env.SHAREPOINT_CLIENT_SECRET
  );
}


// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const TTL = {
  categories: 60 * 60 * 1000,  // 60 min
  docList:    30 * 60 * 1000,  // 30 min
  content:    30 * 60 * 1000,  // 30 min
} as const;

/** Wipe the entire in-memory cache. Called by the revalidate API route. */
export function clearCache(): void {
  cache.clear();
}

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
  if (!isSharePointConfigured()) return fetchCategoriesFromLocal();
  return withCache("categories", TTL.categories, async () => {
    const client = getGraphClient();
    const path = `${getApiBase()}/${DOCS_ROOT}/_categories.json:/content`;
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
  if (!isSharePointConfigured()) return fetchDocListFromLocal(categorySlug);
  return withCache(`doclist:${categorySlug}`, TTL.docList, async () => {
    const client = getGraphClient();
    try {
      const result = await client
        .api(`${getApiBase()}/${DOCS_ROOT}/${categorySlug}:/children`)
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
 */
export async function fetchDocContentFromSharePoint(
  categorySlug: string,
  fileName: string
): Promise<string> {
  if (!isSharePointConfigured()) return fetchDocContentFromLocal(categorySlug, fileName);
  return withCache(`content:${categorySlug}/${fileName}`, TTL.content, async () => {
    const client = getGraphClient();
    const response: Response = await client
      .api(`${getApiBase()}/${DOCS_ROOT}/${categorySlug}/${fileName}:/content`)
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

/**
 * Write raw MDX content back to a file in SharePoint via the Graph API.
 * Requires the Azure AD app to have Files.ReadWrite.All (or Sites.ReadWrite.All)
 * granted in the Azure portal.
 *
 * After a successful write, the in-memory cache entries for this document are
 * cleared so the updated content is picked up on the next request.
 */
export async function writeDocContentToSharePoint(
  categorySlug: string,
  fileName: string,
  content: string
): Promise<void> {
  if (!isSharePointConfigured()) {
    throw new Error("SharePoint is not configured.");
  }

  const client = getGraphClient();
  const path = `${getApiBase()}/${DOCS_ROOT}/${categorySlug}/${fileName}:/content`;

  // PUT the raw content as a Buffer so the Graph SDK sends raw bytes
  // rather than JSON-serialising the string (which would corrupt the MDX).
  const body = Buffer.from(content, "utf-8");
  const response: Response = await client
    .api(path)
    .header("Content-Type", "text/plain")
    .responseType("raw" as never)
    .put(body);

  if (!response.ok) {
    throw new Error(
      `Failed to write ${categorySlug}/${fileName}: ${response.status} ${response.statusText}`
    );
  }

  // Clear the entire in-memory cache so the next read picks up the new
  // content. Targeted key deletes are insufficient when there is any risk
  // of concurrent re-population (e.g. a page render racing the write).
  // Password changes are rare, so wiping the full cache is acceptable.
  cache.clear();
}

/**
 * Pre-populate the in-memory cache on process start so the first real user
 * request hits warm cache instead of cold SharePoint API calls.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function warmSharePointCache(): Promise<void> {
  try {
    const categories = await fetchCategoriesFromSharePoint();

    const docLists = await Promise.all(
      categories.map((cat) =>
        fetchDocListFromSharePoint(cat.slug).then((files) => ({
          categorySlug: cat.slug,
          files,
        }))
      )
    );

    await Promise.all(
      docLists.flatMap(({ categorySlug, files }) =>
        files.map((fileName) =>
          fetchDocContentFromSharePoint(categorySlug, fileName)
        )
      )
    );

  } catch (err) {
    console.error("[sharepoint] cache warming failed:", err);
  }
}

// Fire-and-forget on module load — warms cache before the first user request
void warmSharePointCache();
