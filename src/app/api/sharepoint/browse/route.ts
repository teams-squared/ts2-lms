import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertConfigured, getSharePointConfig } from "@/lib/sharepoint/config";
import { getSiteId, listDriveItems } from "@/lib/sharepoint/graph-client";
import { getCachedMetadata, setCachedMetadata } from "@/lib/sharepoint/cache";
import type { SharePointBrowseItem, SharePointBrowseResponse, SharePointBreadcrumb } from "@/lib/sharepoint/types";
import type { DriveItem } from "@/lib/sharepoint/graph-client";

/** GET /api/sharepoint/browse — browse SharePoint folder contents. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin" && session.user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    assertConfigured();
  } catch (err) {
    const message = err instanceof Error ? err.message : "SharePoint not configured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId") ?? undefined;
  const cacheKey = `browse:${folderId ?? "root"}`;

  // Check metadata cache
  const cached = await getCachedMetadata<SharePointBrowseResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached.data);
  }

  const config = getSharePointConfig();
  const siteId = await getSiteId(config.siteUrl);

  // If no folderId, resolve the root folder by name
  let resolvedFolderId = folderId;
  let driveId: string | undefined;

  if (!resolvedFolderId) {
    const rootItems = await listDriveItems(siteId, "", undefined);
    const rootFolder = rootItems.value.find(
      (item: DriveItem) => item.folder && item.name === config.rootFolder
    );
    if (rootFolder) {
      resolvedFolderId = rootFolder.id;
      driveId = rootFolder.parentReference?.driveId;
    }
  }

  const listing = await listDriveItems(siteId, driveId ?? "", resolvedFolderId);

  const items: SharePointBrowseItem[] = listing.value.map((item: DriveItem) => {
    const itemDriveId = item.parentReference?.driveId ?? driveId ?? "";
    if (item.folder) {
      return {
        type: "folder" as const,
        id: item.id,
        name: item.name,
        childCount: item.folder.childCount,
        driveId: itemDriveId,
      };
    }
    return {
      type: "file" as const,
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType ?? "application/octet-stream",
      size: item.size ?? 0,
      webUrl: item.webUrl ?? "",
      lastModifiedDateTime: item.lastModifiedDateTime ?? "",
      driveId: itemDriveId,
      eTag: item.eTag,
    };
  });

  const breadcrumbs: SharePointBreadcrumb[] = [];
  if (resolvedFolderId) {
    breadcrumbs.push({ id: resolvedFolderId, name: config.rootFolder });
  }

  const response: SharePointBrowseResponse = { items, breadcrumbs };

  await setCachedMetadata(cacheKey, response);

  return NextResponse.json(response);
}
