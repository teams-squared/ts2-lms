import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getDriveItemContent } from "@/lib/sharepoint/graph-client";
import { satisfiesClearance, loadUserTiers } from "@/lib/clearance";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/internal-docs/[id]/video — clearance-gated SharePoint video proxy.
 *  Mirrors the course lesson video proxy but gates on the doc's clearance
 *  requirements instead of enrollment. */
export async function GET(request: Request, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const { id } = await params;
  const doc = await prisma.internalDoc.findUnique({
    where: { id },
    select: {
      type: true,
      content: true,
      clearanceRequirements: { select: { sectorId: true, tier: true } },
    },
  });

  if (!doc || doc.type !== "VIDEO") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clearance gate — deny by default (404, don't reveal existence).
  if ((role as Role) !== "admin") {
    const tiers = await loadUserTiers(userId);
    if (!satisfiesClearance(doc.clearanceRequirements, tiers, false)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let docRef: SharePointDocumentRef | null = null;
  if (doc.content) {
    try {
      docRef = JSON.parse(doc.content) as SharePointDocumentRef;
    } catch {
      docRef = null;
    }
  }
  if (!docRef?.driveId || !docRef?.itemId) {
    return NextResponse.json({ error: "No SharePoint video attached" }, { status: 404 });
  }
  if (!docRef.mimeType?.startsWith("video/")) {
    return NextResponse.json({ error: "Attached file is not a video" }, { status: 415 });
  }

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await getDriveItemContent(docRef.driveId, docRef.itemId, { range });
  } catch {
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", docRef.mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=900");
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
