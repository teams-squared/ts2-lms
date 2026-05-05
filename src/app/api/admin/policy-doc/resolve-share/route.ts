import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { resolveShareUrl } from "@/lib/sharepoint";

const Body = z.object({
  shareUrl: z.string().url(),
});

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * POST /api/admin/policy-doc/resolve-share
 *
 * Takes a SharePoint sharing URL (or any tenant URL pointing at a file in
 * SharePoint / OneDrive) and resolves it to the {driveId, itemId} the
 * sync route needs. Lets admins bind policy docs that live outside the
 * default LMS-Materials folder.
 */
export async function POST(request: Request) {
  const auth = await requireRole("course_manager");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid SharePoint URL" },
      { status: 400 },
    );
  }

  try {
    const item = await resolveShareUrl(parsed.data.shareUrl);

    if (item.folder) {
      return NextResponse.json(
        { error: "Link points to a folder. Paste a link to the .docx file itself." },
        { status: 400 },
      );
    }
    if (!item.file) {
      return NextResponse.json(
        { error: "Link does not resolve to a file." },
        { status: 400 },
      );
    }
    if (item.file.mimeType !== DOCX_MIME) {
      return NextResponse.json(
        {
          error: `Policy docs must be .docx. Link resolved to "${item.name}" (${item.file.mimeType}).`,
        },
        { status: 400 },
      );
    }
    const driveId = item.parentReference?.driveId;
    if (!driveId) {
      return NextResponse.json(
        { error: "Could not determine the SharePoint drive for this file." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      driveId,
      itemId: item.id,
      fileName: item.name,
      mimeType: item.file.mimeType,
      webUrl: item.webUrl ?? null,
    });
  } catch (err) {
    console.error("[policy-doc] resolve-share failed:", err);
    const message = err instanceof Error ? err.message : "Failed to resolve link";
    // Surface 403s distinctly so the admin knows it's a permissions problem.
    const status = /\b403\b/.test(message) ? 403 : 400;
    return NextResponse.json(
      {
        error:
          status === 403
            ? "SharePoint refused the request. Confirm the app registration has Sites.Read.All / Files.Read.All consented."
            : message,
      },
      { status },
    );
  }
}
