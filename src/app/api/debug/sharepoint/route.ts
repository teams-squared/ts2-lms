import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGraphClient } from "@/lib/graph-client";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const SITE_ID = process.env.SHAREPOINT_SITE_ID;
  const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
  const DOCS_ROOT_RAW = process.env.SHAREPOINT_DOCS_ROOT || "Docs for Portal";
  const DOCS_ROOT = encodeURIComponent(DOCS_ROOT_RAW);
  const API_BASE = SITE_ID
    ? `/sites/${SITE_ID}/drive/root:`
    : `/drives/${DRIVE_ID}/root:`;

  const results: Record<string, unknown> = {
    config: {
      SITE_ID: SITE_ID ?? "(not set)",
      DRIVE_ID: DRIVE_ID ?? "(not set)",
      DOCS_ROOT_RAW,
      DOCS_ROOT,
      API_BASE,
    },
  };

  const client = getGraphClient();

  // Step 1: verify site access
  try {
    const site = await client.api(`/sites/${SITE_ID}`).select("displayName,webUrl").get();
    results.step1_site = { ok: true, displayName: site.displayName, webUrl: site.webUrl };
  } catch (e: unknown) {
    results.step1_site = { ok: false, error: String(e) };
    return NextResponse.json(results);
  }

  // Step 2: list drive root children (what's actually at the top level)
  try {
    const root = await client
      .api(`/sites/${SITE_ID}/drive/root/children`)
      .select("name,folder")
      .top(25)
      .get();
    results.step2_driveRoot = {
      ok: true,
      items: (root.value ?? []).map((i: { name: string; folder?: unknown }) => ({
        name: i.name,
        isFolder: !!i.folder,
      })),
    };
  } catch (e: unknown) {
    results.step2_driveRoot = { ok: false, error: String(e) };
    return NextResponse.json(results);
  }

  // Step 3: resolve "Docs for Portal" folder by path
  try {
    const folder = await client
      .api(`${API_BASE}/${DOCS_ROOT}`)
      .select("name,id,webUrl")
      .get();
    results.step3_docsFolder = { ok: true, name: folder.name, id: folder.id, webUrl: folder.webUrl };
  } catch (e: unknown) {
    results.step3_docsFolder = { ok: false, error: String(e) };
    return NextResponse.json(results);
  }

  // Step 4: list children of "Docs for Portal"
  try {
    const children = await client
      .api(`${API_BASE}/${DOCS_ROOT}:/children`)
      .select("name,folder")
      .get();
    results.step4_docsChildren = {
      ok: true,
      items: (children.value ?? []).map((i: { name: string; folder?: unknown }) => ({
        name: i.name,
        isFolder: !!i.folder,
      })),
    };
  } catch (e: unknown) {
    results.step4_docsChildren = { ok: false, error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
