import { getGraphClient } from "./graph-client";
import type { Category, RoleConfig } from "./types";
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
  roles:       5 * 60 * 1000,  //  5 min
} as const;

/** Wipe the entire in-memory cache. Called by the revalidate API route. */
export function clearCache(): void {
  cache.clear();
}

/**
 * Write-through cache update after a successful file write.
 * Caches the content immediately (we already have it) and injects the file
 * name into the doclist for its category if that list is already cached.
 * This means uploads appear instantly in listings without waiting for
 * SharePoint's /children endpoint to reflect the new file.
 */
function writeThroughCache(
  categorySlug: string,
  fileName: string,
  content: string
): void {
  cache.set(`content:${categorySlug}/${fileName}`, {
    value: content,
    expiresAt: Date.now() + TTL.content,
  });

  const listKey = `doclist:${categorySlug}`;
  const listEntry = cache.get(listKey) as CacheEntry<string[]> | undefined;
  if (listEntry && Date.now() < listEntry.expiresAt) {
    if (!listEntry.value.includes(fileName)) {
      cache.set(listKey, {
        value: [...listEntry.value, fileName],
        expiresAt: listEntry.expiresAt,
      });
    }
  }
}

/**
 * Remove a single file from the doclist and content caches without
 * touching any other cached entries.
 */
function evictFromCache(categorySlug: string, fileName: string): void {
  cache.delete(`content:${categorySlug}/${fileName}`);

  const listKey = `doclist:${categorySlug}`;
  const listEntry = cache.get(listKey) as CacheEntry<string[]> | undefined;
  if (listEntry && Date.now() < listEntry.expiresAt) {
    cache.set(listKey, {
      value: listEntry.value.filter((f) => f !== fileName),
      expiresAt: listEntry.expiresAt,
    });
  }
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

  // Write the new content and file name directly into the cache so the
  // document appears in listings immediately, bypassing SharePoint's
  // eventual-consistency delay on its /children listing endpoint.
  writeThroughCache(categorySlug, fileName, content);
}

/**
 * Ensure a category folder exists in SharePoint.
 * Creates the folder if absent; silently succeeds if it already exists.
 * Call this before writing a file to a category for the first time.
 */
export async function ensureCategoryFolder(categorySlug: string): Promise<void> {
  if (!isSharePointConfigured()) {
    throw new Error("SharePoint is not configured.");
  }
  const client = getGraphClient();
  const path = `${getApiBase()}/${DOCS_ROOT}:/children`;
  try {
    await client.api(path).post({
      name: categorySlug,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    });
  } catch (e: unknown) {
    // 409 Conflict means the folder already exists — that's fine.
    const status = (e as { statusCode?: number })?.statusCode;
    if (status !== 409) throw e;
  }
}

/**
 * Permanently delete an MDX document from SharePoint.
 * Clears the in-memory cache after a successful delete.
 */
export async function deleteDocFromSharePoint(
  categorySlug: string,
  fileName: string
): Promise<void> {
  if (!isSharePointConfigured()) {
    throw new Error("SharePoint is not configured.");
  }
  const client = getGraphClient();
  // Path-based addressing: root:/{path}: — trailing colon references the item itself.
  const path = `${getApiBase()}/${DOCS_ROOT}/${categorySlug}/${fileName}:`;
  const response: Response = await client
    .api(path)
    .responseType("raw" as never)
    .delete();

  // Graph API returns 204 No Content on successful delete.
  if (!response.ok) {
    throw new Error(
      `Failed to delete ${categorySlug}/${fileName}: ${response.status} ${response.statusText}`
    );
  }
  evictFromCache(categorySlug, fileName);
}

/**
 * Move (and optionally rename) an MDX document to a different category folder.
 * Fetches the source item's Drive ID and item ID first, then PATCHes via the
 * items endpoint (path-based PATCH is not supported for move operations).
 * Clears the in-memory cache after a successful move.
 */
export async function moveDocInSharePoint(
  fromCategory: string,
  fromFile: string,
  toCategory: string,
  toFile: string
): Promise<void> {
  if (!isSharePointConfigured()) {
    throw new Error("SharePoint is not configured.");
  }
  const client = getGraphClient();

  // Step 1: Resolve the source item's ID and its drive ID.
  const sourcePath = `${getApiBase()}/${DOCS_ROOT}/${fromCategory}/${fromFile}`;
  const item = (await client
    .api(sourcePath)
    .select("id,parentReference")
    .get()) as { id: string; parentReference: { driveId: string } };

  const driveId = item.parentReference.driveId;
  const docsRoot = decodeURIComponent(DOCS_ROOT);

  // Step 2: PATCH to move — must use the /drives/{id}/items/{id} endpoint.
  await client.api(`/drives/${driveId}/items/${item.id}`).patch({
    parentReference: {
      driveId,
      path: `/drives/${driveId}/root:/${docsRoot}/${toCategory}`,
    },
    name: toFile,
  });

  // Remove the file from the source category cache.
  evictFromCache(fromCategory, fromFile);

  // Inject the file into the destination doclist cache if it is already warm.
  // Content at the new path is intentionally not pre-cached — it will be
  // fetched from SharePoint on first access (the file is guaranteed to be
  // there by then since the PATCH succeeded).
  const dstKey = `doclist:${toCategory}`;
  const dstEntry = cache.get(dstKey) as CacheEntry<string[]> | undefined;
  if (dstEntry && Date.now() < dstEntry.expiresAt && !dstEntry.value.includes(toFile)) {
    cache.set(dstKey, {
      value: [...dstEntry.value, toFile],
      expiresAt: dstEntry.expiresAt,
    });
  }
}

/** True when all required SharePoint env vars are present. */
export function isSharePointAvailable(): boolean {
  return isSharePointConfigured();
}

/**
 * Fetch the role configuration (_roles.json) from SharePoint.
 * Returns null when SharePoint is not configured or the file does not exist
 * yet (e.g. first boot before any admin has saved roles).
 */
export async function fetchRolesFromSharePoint(): Promise<RoleConfig | null> {
  if (!isSharePointConfigured()) return null;
  return withCache<RoleConfig | null>("roles", TTL.roles, async () => {
    const client = getGraphClient();
    const apiPath = `${getApiBase()}/${DOCS_ROOT}/_roles.json:/content`;
    try {
      const response: Response = await client
        .api(apiPath)
        .responseType("raw" as never)
        .get();
      if (!response.ok) return null;
      const text = await response.text();
      return JSON.parse(text) as RoleConfig;
    } catch (e) {
      if ((e as { statusCode?: number })?.statusCode === 404) return null;
      throw e;
    }
  });
}

/**
 * Persist the role configuration to _roles.json in SharePoint.
 * Creates the file if it does not exist; overwrites it if it does.
 * Clears the in-memory roles cache so the next read reflects the new state.
 */
export async function writeRolesToSharePoint(config: RoleConfig): Promise<void> {
  if (!isSharePointConfigured()) {
    throw new Error("SharePoint is not configured.");
  }
  const client = getGraphClient();
  const apiPath = `${getApiBase()}/${DOCS_ROOT}/_roles.json:/content`;
  const body = Buffer.from(JSON.stringify(config, null, 2) + "\n", "utf-8");
  const response: Response = await client
    .api(apiPath)
    .header("Content-Type", "application/json")
    .responseType("raw" as never)
    .put(body);
  if (!response.ok) {
    throw new Error(
      `Failed to write _roles.json to SharePoint: ${response.status} ${response.statusText}`
    );
  }
  cache.delete("roles");
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
