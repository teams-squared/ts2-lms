import { auth } from "@/lib/auth";
import { getDriveItemContent, getDriveItemMetadata } from "@/lib/sharepoint/graph-client";
import { getCachedFile, setCachedFile } from "@/lib/sharepoint/cache";

type Params = { params: Promise<{ driveId: string; itemId: string }> };

/** GET /api/sharepoint/files/[driveId]/[itemId] — proxy a SharePoint file. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { driveId, itemId } = await params;

  // Check file cache first
  const cached = await getCachedFile(driveId, itemId);
  if (cached) {
    const isPdf = cached.meta.mimeType === "application/pdf";
    const ab = new ArrayBuffer(cached.data.byteLength);
    new Uint8Array(ab).set(cached.data);
    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": cached.meta.mimeType,
        "Content-Disposition": isPdf
          ? `inline; filename="${cached.meta.fileName}"`
          : `attachment; filename="${cached.meta.fileName}"`,
        "Cache-Control": "private, max-age=900",
      },
    });
  }

  // Fetch metadata + content from Graph
  let metadata;
  try {
    metadata = await getDriveItemMetadata(driveId, itemId);
  } catch {
    return new Response(JSON.stringify({ error: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  let contentRes;
  try {
    contentRes = await getDriveItemContent(driveId, itemId);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const arrayBuffer = await contentRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = metadata.file?.mimeType ?? "application/octet-stream";
  const fileName = metadata.name;
  const isPdf = mimeType === "application/pdf";

  // Cache the file (best-effort, don't fail the request)
  setCachedFile(driveId, itemId, buffer, {
    etag: metadata.eTag ?? null,
    mimeType,
    fileName,
  }).catch(() => {});

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": isPdf
        ? `inline; filename="${fileName}"`
        : `attachment; filename="${fileName}"`,
      "Cache-Control": "private, max-age=900",
    },
  });
}
