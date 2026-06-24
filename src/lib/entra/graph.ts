/**
 * Microsoft Graph directory lookups using an app-only (client-credentials)
 * token. Used to check whether an invite address already exists in the Entra
 * tenant before we send the email.
 *
 * Requires the app registration (AZURE_AD_CLIENT_ID/_SECRET/_TENANT_ID — the
 * same one NextAuth uses) to be granted the **User.Read.All Application**
 * permission with admin consent. Without that grant Graph returns 403 and
 * every lookup degrades to `{ status: "unknown" }` — the caller treats that
 * as "can't tell, allow the send" so the invite flow never hard-fails on us.
 */

const TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

/** Outcome of a directory existence check. `unknown` = not configured, no
 *  permission, or Graph error — caller should fail open. */
export type DirectoryLookup =
  | { status: "found"; accountEnabled: boolean; displayName: string | null }
  | { status: "not_found" }
  | { status: "unknown" };

/** True when the Entra app credentials are present. Doesn't prove the
 *  User.Read.All grant exists — a lookup can still come back `unknown`. */
export function isDirectoryLookupConfigured(): boolean {
  return Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET);
}

// Module-scoped token cache. Each serverless instance keeps its own; the
// token lives ~60-90 min so this saves a round-trip on most lookups.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAppToken(now: number): Promise<string | null> {
  if (!isDirectoryLookupConfigured()) return null;
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
          grant_type: "client_credentials",
          scope: "https://graph.microsoft.com/.default",
        }),
      },
    );
    if (!res.ok) {
      console.error("[entra] token request failed", res.status);
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return data.access_token;
  } catch (err) {
    console.error("[entra] token request error", err);
    return null;
  }
}

/** A directory user surfaced as an invite suggestion. */
export type DirectoryMatch = {
  email: string;
  displayName: string | null;
  accountEnabled: boolean;
};

/** Escape a string for safe interpolation into an OData filter literal. */
function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Prefix-search the tenant for invite suggestions. Matches the typed prefix
 * against `mail`, `userPrincipalName`, `displayName`, `givenName`, and
 * `surname` so typing `akil` surfaces `akil.fernando@…`, `akil.pereira@…`,
 * etc. Returns up to `top` matches sorted by display name. Fails open to an
 * empty list (no suggestions) on any error so the invite flow still works by
 * manual entry.
 */
export async function searchTenantUsers(
  query: string,
  top = 8,
): Promise<DirectoryMatch[]> {
  const prefix = query.trim().toLowerCase();
  if (prefix.length < 2) return [];

  const token = await getAppToken(Date.now());
  if (!token) return [];

  const lit = escapeODataLiteral(prefix);
  const filter =
    `startswith(mail,'${lit}') or startswith(userPrincipalName,'${lit}') ` +
    `or startswith(displayName,'${lit}') or startswith(givenName,'${lit}') ` +
    `or startswith(surname,'${lit}')`;
  const url =
    `https://graph.microsoft.com/v1.0/users?` +
    `$filter=${encodeURIComponent(filter)}` +
    `&$select=mail,userPrincipalName,displayName,accountEnabled` +
    `&$top=${top}&$count=true`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // startswith across multiple props is an advanced query.
        ConsistencyLevel: "eventual",
      },
    });
    if (!res.ok) {
      console.error("[entra] user search failed", res.status);
      return [];
    }
    const data = (await res.json()) as {
      value?: Array<{
        mail?: string | null;
        userPrincipalName?: string | null;
        displayName?: string | null;
        accountEnabled?: boolean;
      }>;
    };
    return (data.value ?? [])
      // Guests' UPN is the mangled `#EXT#` form — prefer the real `mail`.
      .map((u) => ({
        email: (u.mail ?? u.userPrincipalName ?? "").toLowerCase(),
        displayName: u.displayName ?? null,
        accountEnabled: u.accountEnabled ?? true,
      }))
      .filter((u) => u.email)
      .sort((a, b) =>
        (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
      );
  } catch (err) {
    console.error("[entra] user search error", err);
    return [];
  }
}

/**
 * All enabled-account emails in the tenant (mail + userPrincipalName,
 * lowercased). Returns null on ANY error or config gap — caller MUST fail
 * closed (never offboard on an incomplete picture).
 */
export async function listEnabledTenantEmails(): Promise<Set<string> | null> {
  const token = await getAppToken(Date.now());
  if (!token) return null;

  const emails = new Set<string>();
  let url: string | undefined =
    "https://graph.microsoft.com/v1.0/users" +
    "?$filter=accountEnabled%20eq%20true" +
    "&$select=mail,userPrincipalName&$top=999";

  const MAX_PAGES = 100;
  let page = 0;

  try {
    while (url && page < MAX_PAGES) {
      page++;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("[entra] enabled-users list failed", res.status);
        return null;
      }
      const data = (await res.json()) as {
        value: Array<{ mail?: string | null; userPrincipalName?: string | null }>;
        "@odata.nextLink"?: string;
      };
      for (const u of data.value) {
        if (u.mail) emails.add(u.mail.toLowerCase());
        if (u.userPrincipalName) emails.add(u.userPrincipalName.toLowerCase());
      }
      url = data["@odata.nextLink"];
    }
  } catch (err) {
    console.error("[entra] enabled-users list failed", err);
    return null;
  }

  return emails;
}

/**
 * Look up an email across the tenant. Matches members by `mail`/
 * `userPrincipalName` and guests by `otherMails` (a guest's UPN is the
 * mangled `name_domain.com#EXT#@tenant.onmicrosoft.com` form, so the real
 * address lives in `mail`/`otherMails`). Returns `unknown` on any failure so
 * callers fail open.
 */
export async function lookupTenantUser(email: string): Promise<DirectoryLookup> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { status: "unknown" };

  const token = await getAppToken(Date.now());
  if (!token) return { status: "unknown" };

  const lit = escapeODataLiteral(normalized);
  const filter =
    `mail eq '${lit}' or userPrincipalName eq '${lit}' ` +
    `or otherMails/any(m:m eq '${lit}')`;
  const url =
    `https://graph.microsoft.com/v1.0/users?` +
    `$filter=${encodeURIComponent(filter)}` +
    `&$select=id,displayName,accountEnabled&$top=1&$count=true`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // `otherMails/any(...)` is an advanced query — needs these two.
        ConsistencyLevel: "eventual",
      },
    });
    if (!res.ok) {
      console.error("[entra] user lookup failed", res.status);
      return { status: "unknown" };
    }
    const data = (await res.json()) as {
      value?: Array<{ accountEnabled?: boolean; displayName?: string | null }>;
    };
    const hit = data.value?.[0];
    if (!hit) return { status: "not_found" };
    return {
      status: "found",
      accountEnabled: hit.accountEnabled ?? true,
      displayName: hit.displayName ?? null,
    };
  } catch (err) {
    console.error("[entra] user lookup error", err);
    return { status: "unknown" };
  }
}
