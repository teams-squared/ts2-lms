export type {
  SharePointDocumentRef,
  SharePointFile,
  SharePointFolder,
  SharePointBrowseItem,
  SharePointBreadcrumb,
  SharePointBrowseResponse,
} from "./types";

export {
  GRAPH_BASE_URL,
  METADATA_CACHE_TTL_MS,
  ALLOWED_MIME_TYPES,
  getSharePointConfig,
  getTokenUrl,
  assertConfigured,
} from "./config";

export {
  getAccessToken,
  getSiteId,
  listDriveItems,
  getDriveItemContent,
  getDriveItemMetadata,
  resolveShareUrl,
  _resetTokenCache,
} from "./graph-client";
export type { DriveItem } from "./graph-client";

export {
  getCachedMetadata,
  setCachedMetadata,
  extendCacheTTL,
  cleanExpiredMetadata,
  getCachedFile,
  setCachedFile,
  cleanExpiredFiles,
} from "./cache";
