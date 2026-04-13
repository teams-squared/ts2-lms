export const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export const METADATA_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function getSharePointConfig() {
  return {
    tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
    clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
    siteUrl: process.env.SHAREPOINT_SITE_URL ?? "teamssquared.sharepoint.com/sites/cybersecurity",
    rootFolder: process.env.SHAREPOINT_ROOT_FOLDER ?? "LMS Materials",
  };
}

export function getTokenUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export function assertConfigured(): void {
  const { tenantId, clientId, clientSecret } = getSharePointConfig();
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "SharePoint integration requires AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, and AZURE_AD_CLIENT_SECRET"
    );
  }
}
