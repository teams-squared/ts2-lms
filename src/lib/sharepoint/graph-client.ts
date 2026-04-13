import { GRAPH_BASE_URL, getSharePointConfig, getTokenUrl } from "./config";

// ─── Token cache with promise dedup ────────────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

/** Exported for testing — resets the in-memory token cache. */
export function _resetTokenCache(): void {
  tokenCache = null;
  tokenPromise = null;
}

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  // Deduplicate concurrent callers
  if (tokenPromise) return tokenPromise;

  tokenPromise = fetchToken().finally(() => {
    tokenPromise = null;
  });

  return tokenPromise;
}

async function fetchToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = getSharePointConfig();
  const url = getTokenUrl(tenantId);

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ─── Graph API helpers ─────────────────────────────────────────────────────

async function graphFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  return res;
}

/** Resolve a SharePoint site URL to its Graph site ID. */
export async function getSiteId(siteUrl: string): Promise<string> {
  // siteUrl format: "hostname/sites/siteName"
  const firstSlash = siteUrl.indexOf("/");
  const hostname = siteUrl.slice(0, firstSlash);
  const sitePath = siteUrl.slice(firstSlash);

  const res = await graphFetch(`/sites/${hostname}:${sitePath}`);
  if (!res.ok) {
    throw new Error(`Failed to resolve site (${res.status}): ${siteUrl}`);
  }

  const data = await res.json();
  return data.id;
}

/** List children of a drive folder. If folderId is omitted, lists root. */
export async function listDriveItems(
  siteId: string,
  driveId: string,
  folderId?: string
): Promise<{ value: DriveItem[] }> {
  const path = folderId
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/sites/${siteId}/drive/root/children`;

  const res = await graphFetch(path);
  if (!res.ok) {
    throw new Error(`Failed to list drive items (${res.status})`);
  }

  return res.json();
}

/** Get the binary content of a drive item (for streaming to the client). */
export async function getDriveItemContent(
  driveId: string,
  itemId: string
): Promise<Response> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}/content`, {
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to get drive item content (${res.status})`);
  }
  return res;
}

/** Get metadata for a single drive item. */
export async function getDriveItemMetadata(
  driveId: string,
  itemId: string
): Promise<DriveItem> {
  const res = await graphFetch(
    `/drives/${driveId}/items/${itemId}?$select=id,name,size,file,folder,webUrl,lastModifiedDateTime,eTag,parentReference`
  );
  if (!res.ok) {
    throw new Error(`Failed to get drive item metadata (${res.status})`);
  }
  return res.json();
}

// ─── Graph API types ───────────────────────────────────────────────────────

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  eTag?: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { driveId: string; id: string; path?: string };
}
